---
title: 2024秋冬季开源操作系统训练营第三阶段总结报告-hxingjie
date: 2024-11-30 23:22:06
categories:
    - summary report
tags:
    - author:hxingjie
    - repo:https://github.com/hxingjie/oscamp_0
---


## 一、前言

在过去三周，我学习了Unikernel, Monolithic Kernel, Hypervisor三种内核架构。经过学习，我对组件化操作系统有了初步的认识和掌握。以下是我对这三周学习过程的总结。



## 二、学习内容

### 1. Unikernel
在第一部分，学习了Unikernel的相关知识，完成了三个作业

1.1 实现带颜色的打印输出

(1) 修改 axstd 实现带颜色的打印输出
在 ulib/axstd/src/lib.rs 中添加打印函数 

```rust
fn println_with_color(msg: &str, color: &str)，
```

使用match表达式匹配需要打印的颜色

```rust
let color = match color {
    "black" => "\x1b[30m",
    "red" => "\x1b[31m",
    "green" => "\x1b[32m",
    "yellow" => "\x1b[33m",
    "blue" => "\x1b[34m",
    _ => "\x1b[30m",
};
```

实现带颜色的打印输出

```rust
println!("{}[WithColor]: {}\x1b[0m", color, msg);
```
(2) 修改 axhal 实现带颜色的打印输出
在 module/axhal/src/lib.rs 修改函数 fn write_bytes(bytes: &[u8])

在函数的首尾添加打印颜色符号的字符串即可

```rust
let beg = b"\x1b[34m";
for c in beg {
    putchar(*c);
}
//...
let end = b"\x1b[0m";
for c in end {
    putchar(*c);
}
```


1.2 手写HashMap
使用拉链法实现哈希表，
(1) 设计数据结构:

```rust
pub struct MyHashMap<K, V> 
where 
    K: ToString + PartialEq + Clone,
    V: Clone,
{
    size: usize, // 键值对数量
    capacity: usize, // map中第一维的长度
    map: Vec<Vec<(K, V)>>, // 邻接表
}
```
(2) 哈希函数:
```rust
fn hashcode(&self, string: &str) -> usize{
    let mut sum: usize = 0;
    // a0*31^0 + a1*31^1 + ... + ai*31^i
    for byte in string.as_bytes() {
        sum = sum * 31 + *byte as usize;
    }
    sum % self.capacity
}
```
(3) 插入函数: 根据key计算哈希值，根据哈希值插入对应的链表即可，

实现细节: 先使用迭代器检查key是否存在于相应的链表中，如果已存在就更新键值，不存在就插入键值对；然后检查 self.size 是否大于 self.capacity as f64 * 0.75，大于的话就扩容到 self.capacity * 2

(4) 实现 iter 函数

```rust
pub fn (&self) -> MyHashMapIterator<K, V>
```

MyHashMapIterator<K, V>的实现

```rust
pub struct MyHashMapIterator<'a, K, V> {
    current: usize,
    len: usize,
    data: Vec<(&'a K, &'a V)>,
}
```



1.3 EarlyAllocator
数据结构:

```rust
struct MemUnit {
    ptr_byte: usize, // 字节分配指针
    ptr_page: usize, // 页分配指针
    size: usize,
}

pub struct EarlyAllocator<const PAGE_SIZE: usize> {
    total_bytes: usize,
    used_bytes: usize,

    total_pages: usize,
    used_pages: usize,

    mem: [MemUnit; 8192],
    mem_sz: usize,
}
```
只负责分配，需要分配地址时，首先遍历可用的内存数组，先对齐地址，再检查是否有足够的内存可供分配，有的话直接分配即可，然后更新对应的指针



1.4 shell 程序

(1) rename

```rust
fn do_rename(args: &str) {
    // 处理空格获取 old_name, new_name
  	// 检查是否新旧命名是否相同
  	
  	// 辅助函数
    fn rename_one(old_name: &str, new_name: &str) -> io::Result<()> {
        fs::rename(old_name, new_name)?; // 调用 fs 提供的接口即可
        Ok(())
    }
  
  	if let Err(err) = rename_one(old_name, new_name) {
        print_err!("rename", err);
    }
}
```



(2) mv

递归的思路，如果是文件就直接赋值，如果是文件夹就递归调用函数

```rust
// 辅助函数，调用 fs 中的 remove 接口
fn my_rm(path: &str) -> io::Result<()> {
    if fs::metadata(path)?.is_dir() {
        fs::remove_dir(path)
    } else {
        fs::remove_file(path)
    }
}
```

```rust
// 辅助函数，读取旧文件，创建新文件并写入
fn my_mv_file(src_path: &str, file_path: &str, file_name: &str, tar_path: &str) -> io::Result<()> {
		//... 路径相关
    let mut file = File::open(file_name).unwrap();
    file.read(&mut buf)?; // 读取旧文件
    my_rm(file_name)?; // 删除旧文件
		
  	// 创建新文件并写入
    let mut file = File::create(file_name).unwrap();
    file.write_all(&buf)?;
  
  	//... 路径相关
}
```

```rust
// 核心函数
fn my_mv (old_path: &str, tar_path: &str) -> io::Result<()>{
        //...
        if fs::metadata(old_path)?.is_dir() { // 如果是文件夹
            //... 路径相关
          	// 读取文件夹的内容
            for entry in entries { // 遍历文件夹
              	//...
                if fs::metadata(path.as_str())?.is_dir() { // 递归调用该函数
                    path.push('/');
                    my_mv(path.as_str(), tar_path)?;
                } else { // 直接移动文件
                    my_mv_file(src_path, old_path, entry, tar_path)?;
                }
            }

            my_rm(old_path) // 移除旧文件夹
        } else {
            //... 路径相关
            my_mv_file(src_path, file_path, file_name, tar_path)
        }
    }
```

```rust
// 接口函数
fn do_mv(args: &str) {
  	//...
    let (old_path, tar_path) = split_whitespace(args);    
    if let Err(err) = my_mv(old_path, tar_path) {
        print_err!("mv", err);
    }
    
}
```



### 2. Monolithic Kernel

2.1 lazy映射
```rust
fn handle_page_fault(vaddr: VirtAddr, mut access_flags: MappingFlags, is_user: bool) -> bool {
    ax_println!("handle_page_fault ...");
    // 调用相应的函数即可
    axtask::current().task_ext().aspace.lock().handle_page_fault(vaddr, access_flags)
}
```



2.2 sys_mmap
实现 sys_mmap

```rust
fn sys_mmap(addr: *mut usize, length: usize, prot: i32, flags: i32, fd: i32, _offset: isize) -> isize
```

```rust
// 使用函数读取内容
api::sys_read(fd, &mut buf as *mut[u8] as *mut c_void, length);

// 找空余空间
let vaddr = uspace.lock().find_free_area(start, length, VirtAddrRange::new(start, end)).unwrap();

// 映射, 写入
uspace.lock().map_alloc(vaddr, 0x1000, MappingFlags::READ|MappingFlags::WRITE|MappingFlags::USER, true);
uspace.lock().write(vaddr, &buf[..])
```



### 3. Hypervisor

3.1 处理异常
```rust
Trap::Exception(Exception::IllegalInstruction) => {
    //"csrr a1, mhartid",
    ax_println!("Bad instruction: {:#x} sepc: {:#x}", 
        stval::read(), 
        ctx.guest_regs.sepc
    );
    ctx.guest_regs.gprs.set_reg(A1, 0x1234);
    ctx.guest_regs.sepc += 4;
},
Trap::Exception(Exception::LoadGuestPageFault) => {
    //"ld a0, 64(zero)",
    ax_println!("LoadGuestPageFault: stval{:#x} sepc: {:#x}",
         stval::read(),
         ctx.guest_regs.sepc
    );
    ctx.guest_regs.gprs.set_reg(A0, 0x6688);
    ctx.guest_regs.sepc += 4;
},
```



3.2  加载外部文件

```rust
NestedPageFault{addr, access_flags} => {
    // ...
    let buffer = read("/sbin/pflash.img"); // 读取文件
    if let Ok(buf) = buffer {
        let tmp = &buf[..4];
        aspace.map_alloc(addr, 4096, mapping_flags, true); // 映射
        aspace.write(addr, tmp); // 写入
    } else {
        warn!("read fail");
    }
},
```
