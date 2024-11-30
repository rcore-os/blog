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

(1) 修改axstd
在 ulib/axstd/src/lib.rs 中添加打印函数 fn println_with_color(msg: &str, color: &str)，其中的核心代码是
```rust
println!("{}[WithColor]: {}\x1b[0m", color, msg);
```
color使用match表达式匹配，可以根据参数选择打印的颜色


(2) 修改axhal
在 module/axhal/src/lib.rs 修改函数 fn write_bytes(bytes: &[u8])
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
在首尾打印颜色符号

1.2 手写HashMap
使用拉链法实现哈希表，
数据结构:
```rust
pub struct MyHashMap<K, V> 
where 
    K: ToString + PartialEq + Clone,
    V: Clone,
{
    size: usize, // 键值对数量
    capacity: usize, // map.len
    map: Vec<Vec<(K, V)>>, // 邻接表
}
```
哈希函数:
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
根据key计算哈希值，根据哈希值插入对应的链表即可

1.3 EarlyAllocator
数据结构:
```rust
struct MemUnit {
    ptr_byte: usize,
    ptr_page: usize,
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
只负责分配即可，需要分配地址时，首先遍历可用的内存数组，检查是否有重叠，没有重叠的话对齐好地址直接分配即可，然后更新对应的指针

2.4 shell 程序
### 4.shell
```rust
fn do_rename(args: &str) {
    //...
    fn rename_one(old_name: &str, new_name: &str) -> io::Result<()> {
        fs::rename(old_name, new_name)?; // 调用接口即可
        Ok(())
    }
}

fn do_mv(args: &str) {
    // 递归的思路，如果是文件就直接赋值，如果是文件夹就递归调用函数
    fn my_mv (old_path: &str, tar_path: &str) -> io::Result<()>{
        let pwd = std::env::current_dir().unwrap();
        let src_path = path_to_str!(pwd); // call func's path

        if fs::metadata(old_path)?.is_dir() {
            //...

            let entries = fs::read_dir(old_path)?
                .filter_map(|e| e.ok())
                .map(|e| e.file_name())
                .collect::<Vec<_>>();

            for entry in entries {
                let entry = path_to_str!(entry);
                let mut path = String::from(old_path) + "/" + entry;
                if fs::metadata(path.as_str())?.is_dir() {
                    path.push('/');
                    my_mv(path.as_str(), tar_path)?;
                } else {
                    my_mv_file(src_path, old_path, entry, tar_path)?;
                }
            }

            my_rm(old_path)
        } else {
            //...
            my_mv_file(src_path, file_path, file_name, tar_path)
        }
    }

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

2.2 支持Linux APP
(1) sys_mmap
实现 fn sys_mmap(addr: *mut usize, length: usize, prot: i32, flags: i32, fd: i32, _offset: isize) -> isize
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

3.2 
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
