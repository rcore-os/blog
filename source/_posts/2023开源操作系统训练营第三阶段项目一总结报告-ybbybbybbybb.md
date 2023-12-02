---
title: 2023开源操作系统训练营第三阶段项目一总结报告-ybbybbybbybb
date: 2023-12-02 22:46:08
categories:
    - oscamp 2023fall arceos unikernel
tags:
    - author:ybbybbybbybb
    - 2023秋冬季开源操作系统训练营
    - 第三阶段总结报告
---

# 2023开源操作系统训练营第三阶段项目一总结报告

## 练习1,2:
该练习实现了一个 app 名为 loader 的外部应用加载器,然后实现了两个外部应用,熟悉了编译生成和封装二进制文件的流程.

该练习的重点在于头结构的构造与实现,我将应用的头结构大致分为三部分,第一部分为应用数量,第二部分为各应用长度,第三部分为应用数据.

大致实现如下
```
type BinNumType = u32;
const BIN_NUM_TYPE_BYTES: usize = 4;
type BinSizeType = u32;
const BIN_SIZE_TYPE_BYTES: usize = 4;
let apps_num = unsafe {
    (*(PLASH_START as *const BinNumType)).to_be()
};
let mut size_offset = PLASH_START + BIN_NUM_TYPE_BYTES;
let mut start_offset = size_offset + BIN_SIZE_TYPE_BYTES * apps_num as usize;
for i in 0 .. apps_num {
    let load_size = unsafe {
        (*(size_offset as *const BinSizeType)).to_be() as usize
    };
    let load_code = unsafe {
        core::slice::from_raw_parts(start_offset as *const u8, load_size)
    };
    println!("load code {:?}; address [{:?}]", load_code, load_code.as_ptr());
    let run_code = unsafe {
        core::slice::from_raw_parts_mut(RUN_START as *mut u8, load_size)
    };
    run_code.copy_from_slice(load_code);
    println!("run code {:?}; address [{:?}] size [{}]", run_code, run_code.as_ptr(), load_size);
    size_offset += BIN_SIZE_TYPE_BYTES;
    start_offset += load_size;
}
```
下面是构造image文件的大致代码
```
#!/bin/bash
# 获取当前目录下所有的 .bin 文件
apps=(hello_app.bin putd_app.bin)
# 计算应用数量
num_apps=${#apps[@]}
# 创建临时文件用于存储应用大小
size_file="temp_sizes.bin"
> "$size_file"
# 创建一个新的文件用于存储合并后的应用内容
content_file="temp_content.bin"
> "$content_file"
# 写入应用数量（4 字节）
printf "%08x" $num_apps | xxd -r -p > "$size_file"
# 循环遍历每个应用并写入其大小到临时文件
for app in "${apps[@]}"; do
    # 获取并写入当前应用大小（4 字节）
    app_size=$(stat -c%s "$app")
    printf "%08x" $app_size | xxd -r -p >> "$size_file"
    # 追加应用内容到另一个临时文件
    cat "$app" >> "$content_file"
done
combined_file="combined.bin"
# 合并大小信息和应用内容
cat "$size_file" "$content_file" > "$combined_file"
output_file="apps.bin"
dd if=/dev/zero of="$output_file" bs=1M count=32
dd if="$combined_file" of="$output_file" conv=notrunc
mkdir -p ../arceos/payload
mv "$output_file" ../arceos/payload/apps.bin
# 清理临时文件
rm "$size_file" "$content_file" "$combined_file"
echo "合并完成,输出文件：$output_file"

```

## 练习3

本实验较为简单,在原来的基础上修改外部应用的汇编指令以及然后在遍历程序时将其执行即可.

## 练习4

本实验也比较简单,仿照前面的系统调用写一个即可,关机方法:std::process::exit.

## 练习5

因为多次系统调用a7寄存器的值会被修改,导致报错,所以我们需要将其存入变量中防止abi_table被修改,而且还要声明clobber_abi("C")保持Rust代码与内联汇编之间的一致性.然后在我写的过程中,出现了冒用 in(reg) 和 out(reg) 的错误,导致传入的 ABI 接口的地址导致调用函数的时候接口地址丢失,在第二次调用的访问未映射的地址导致错误发生.

## 练习6

在练习5的基础上,初始化地址空间以后,对于每一个外部应用调用 RUN_START 前切换地址空间即可.但此时应用并无法正确返回,是因为外部引用主动阻塞导致的,外部应用不能进行阻塞,我们需要修改 _start 函数的返回值为 ();
