---
title: arceOS 学习总结
date: 2025-11-04 06:28:59
categories:
  - 2025 秋冬季开源操作系统训练营
tags:
  - author:yoinspiration
  - repo:https://github.com/LearningOS/2025a-arceos-yoinspiration.git
  - arceOS
  - 练习总结
  - 操作系统
---

# arceOS 学习总结

## 前言

arceOS 是一个用 Rust 编写的模块化操作系统，与 rcore 相比，arceOS 采用了更加模块化的设计思路。

这次学习 arceOS 的练习，我花了不少时间。虽然之前做过 rcore 的实验，但 arceOS 的模块化设计和实现方式还是让我遇到了不少挑战。特别是在虚拟化部分，两级地址转换机制让我困惑了很久，好在最后通过看源码和调试还有网站上的博客，终于理解了。

这篇博客主要记录我在完成这些练习过程中的学习体会、遇到的问题以及解决思路。内核的学习实际上最重要的部分可能更是在于解决问题，也就是在针对特定问题的排查思路上。

## 练习概览

本次学习完成了以下练习：

1. **print_with_color** - 带颜色的控制台输出
2. **alt_alloc** - 备用分配器测试
3. **ramfs_rename** - 文件系统重命名功能
4. **support_hashmap** - 内存管理测试
5. **sys_map** - 系统调用映射实现
6. **simple_hv** - 简单虚拟化器实现

其中 `simple_hv` 是最复杂的，花了我最多时间。其他练习相对简单，但每个练习都让我对 arceOS 的设计有了更深入的理解。

---

## 练习一：print_with_color

### 学习过程

这个练习看似简单，但一开始我也遇到了一些困惑。在无标准库（no_std）的环境下，如何实现带颜色的输出？我之前在 Linux 上用过 ANSI 转义序列，但在 Rust 的字符串字面量中如何表示 ESC 字符？

### 实现

最终实现的代码很简单：

```rust
#![cfg_attr(feature = "axstd", no_std)]
#![cfg_attr(feature = "axstd", no_main)]

#[cfg(feature = "axstd")]
use axstd::println;

#[cfg_attr(feature = "axstd", no_mangle)]
fn main() {
    // ANSI color code: \u{1B}[32m for green
    println!("\u{1B}[32m[WithColor]: Hello, Arceos!\u{1B}[m");
}
```

关键点：

- 使用`no_std`特性，不依赖标准库
- 使用`axstd::println!`宏而不是标准库的`println!`
- ANSI 转义序列使用 Unicode 转义`\u{1B}`表示 ESC 字符

通过查看 arceOS 源码，我发现 arceOS 的打印系统（`axlog`模块）已经内置了对 ANSI 转义序列的支持，但`with_color!`宏是模块内部的私有宏，无法在外部直接使用。所以直接使用 ANSI 转义序列是合理的选择。

### 遇到的问题和解决方案

#### 问题 1：Unicode 转义序列的写法

**问题**：最初尝试使用`\x1B`但编译失败。

**原因**：Rust 中字符串字面量需要使用 Unicode 转义序列`\u{1B}`而不是十六进制转义`\x1B`。

**解决**：使用`\u{1B}`来表示 ESC 字符。

#### 问题 2：颜色代码的理解

**问题**：不清楚不同颜色对应的 ANSI 代码。

**学习**：

- 30-37：标准颜色（黑、红、绿、黄、蓝、品红、青、白）
- 90-97：亮色（高亮版本）
- 32：绿色（本练习使用）

#### 问题 3：终端是否支持颜色

**问题**：在某些终端中，ANSI 转义序列可能被过滤或不被支持。

**解决**：测试脚本会检查输出中是否实际包含 ANSI 转义序列，确保不仅输出了文本，还输出了颜色控制码。

### 学习感悟

这个练习虽然简单，但让我理解了 arceOS 的模块化设计。即使是简单的功能，也需要考虑底层实现。另外，在 Rust 中表示特殊字符需要使用 Unicode 转义，这也是一个小的知识点。

---

## 练习二：alt_alloc

### 学习过程

这个练习主要是测试备用分配器（bump allocator）的功能。虽然代码很简单，但让我理解了 arceOS 的模块化设计——可以通过 feature 标志在编译时选择不同的分配器实现。

### 实现

```1:26:arceos/exercises/alt_alloc/src/main.rs
#![cfg_attr(feature = "axstd", no_std)]
#![cfg_attr(feature = "axstd", no_main)]

#[macro_use]
#[cfg(feature = "axstd")]
extern crate axstd as std;
extern crate alloc;

use alloc::vec::Vec;

#[cfg_attr(feature = "axstd", no_mangle)]
fn main() {
    println!("Running bump tests...");

    const N: usize = 3_000_000;
    let mut v = Vec::with_capacity(N);
    for i in 0..N {
        v.push(i);
    }
    v.sort();
    for i in 0..N - 1 {
        assert!(v[i] <= v[i + 1]);
    }

    println!("Bump tests run OK!");
}
```

### 遇到的问题和解决方案

**问题**：在分配 300 万个元素时，程序偶尔会崩溃。

**原因**：bump allocator 是线性分配器，在内存不足时会失败。

**解决**：通过查看 `alt_axalloc` 的源码，理解了 bump allocator 的工作原理。它从内存池的一端开始分配，只能向前推进，不能释放单个分配。这让我理解了为什么需要不同的分配器策略。

### 学习感悟

这个练习虽然简单，但让我看到了 arceOS 模块化设计的优势。通过 feature 标志，可以在编译时选择不同的实现，这种设计非常灵活。

---

## 练习三：ramfs_rename

### 学习过程

这个练习主要是实现文件系统重命名功能。一开始我以为会很简单，但实际做起来发现需要理解 arceOS 的文件系统抽象。特别是 `ramfs.rs` 的实现，让我理解了文件系统接口的设计。

### 实现

```13:53:arceos/exercises/ramfs_rename/src/main.rs
fn create_file(fname: &str, text: &str) -> io::Result<()> {
    println!("Create '{}' and write [{}] ...", fname, text);
    let mut file = File::create(fname)?;
    file.write_all(text.as_bytes())
}

// Only support rename, NOT move.
fn rename_file(src: &str, dst: &str) -> io::Result<()> {
    println!("Rename '{}' to '{}' ...", src, dst);
    fs::rename(src, dst)
}

fn print_file(fname: &str) -> io::Result<()> {
    let mut buf = [0; 1024];
    let mut file = File::open(fname)?;
    loop {
        let n = file.read(&mut buf)?;
        if n > 0 {
            print!("Read '{}' content: [", fname);
            io::stdout().write_all(&buf[..n])?;
            println!("] ok!");
        } else {
            return Ok(());
        }
    }
}

fn process() -> io::Result<()> {
    create_file("/tmp/f1", "hello")?;
    // Just rename, NOT move.
    // So this must happen in the same directory.
    rename_file("/tmp/f1", "/tmp/f2")?;
    print_file("/tmp/f2")
}
```

### 遇到的问题和解决方案

**问题**：最初不理解为什么需要 `ramfs.rs` 这个文件，以及它和主代码的关系。

**原因**：arceOS 使用 trait 来抽象文件系统，需要实现 `MyFileSystemIf` trait。

**解决**：通过查看 `ramfs.rs` 的代码，理解了文件系统接口的设计。它使用 `crate_interface::impl_interface` 来实现接口，这是 arceOS 模块化设计的一部分。

### 学习感悟

通过这个练习，我理解了 arceOS 文件系统的抽象设计。虽然实现简单，但背后的设计理念很清晰。在 no_std 环境下实现类似标准库的 API，这种设计很优雅。

---

## 练习四：support_hashmap

### 学习过程

这个练习主要是测试 arceOS 对集合类型（BTreeMap）的支持。虽然代码很简单，但让我理解了 arceOS 如何在 no_std 环境下提供标准库的替代实现。

### 实现

```17:29:arceos/exercises/support_hashmap/src/main.rs
fn test_hashmap() {
    const N: u32 = 50_000;
    let mut m = BTreeMap::new();
    for value in 0..N {
        let key = format!("key_{value}");
        m.insert(key, value);
    }
    for (k, v) in m.iter() {
        if let Some(k) = k.strip_prefix("key_") {
            assert_eq!(k.parse::<u32>().unwrap(), *v);
        }
    }
    println!("test_hashmap() OK!");
}
```

### 遇到的问题和解决方案

**问题**：在插入大量数据时，程序运行时间较长。

**原因**：BTreeMap 使用 B 树实现，插入操作需要维护树结构。

**解决**：通过测试，理解了 BTreeMap 的性能特征。虽然插入较慢，但查找和遍历操作比较高效。

### 学习感悟

这个练习让我理解了 arceOS 如何提供标准库的替代实现。在 no_std 环境下，需要自己实现这些数据结构，但这种设计让系统更加可控。

---

## 练习五：sys_map

### 学习过程

这个练习比较复杂，涉及系统调用的实现。一开始我对用户程序加载和地址空间管理不太理解，特别是 `sys_mmap` 的实现，花了我不少时间。

### 实现

这个练习主要包括：

1. 用户程序加载：从文件系统加载 ELF 文件到用户地址空间
2. 系统调用处理：实现 `mmap`、`open`、`read`、`write`、`exit` 等系统调用
3. 内存映射：实现 `sys_mmap`，支持匿名映射和文件映射

### 关键实现 - sys_mmap

```139:194:arceos/exercises/sys_map/src/syscall.rs
#[allow(unused_variables)]
fn sys_mmap(
    addr: *mut usize,
    length: usize,
    prot: i32,
    flags: i32,
    fd: i32,
    _offset: isize,
) -> isize {
    syscall_body!(sys_mmap, {
        // Get the user space address space
        let curr = current();
        let task_ext = curr.task_ext();
        let mut aspace = task_ext.aspace.lock();

        // Parse flags
        let mmap_flags = MmapFlags::from_bits_truncate(flags);
        let mmap_prot = MmapProt::from_bits_truncate(prot);

        // Align address and size to page boundaries first
        let aligned_length = (length + PAGE_SIZE_4K - 1) & !(PAGE_SIZE_4K - 1);

        // Allocate virtual address if addr is NULL
        let aligned_vaddr = if !addr.is_null() {
            VirtAddr::from(addr as usize).align_down_4k()
        } else {
            // Find a suitable virtual address below stack
            // Stack is at [aspace.end() - USER_STACK_SIZE, aspace.end())
            // So we place mmap at aspace.end() - USER_STACK_SIZE - aligned_length
            (aspace.end() - USER_STACK_SIZE - aligned_length).align_down_4k()
        };

        // Map the memory
        let mapping_flags = MappingFlags::from(mmap_prot) | MappingFlags::USER;
        aspace.map_alloc(aligned_vaddr, aligned_length, mapping_flags, true)?;

        // If it's a file mapping, read the file and write to the mapped memory
        if !mmap_flags.contains(MmapFlags::MAP_ANONYMOUS) && fd >= 0 {
            // Read from file
            let mut data = vec![0u8; aligned_length];
            let mut read_count = 0;
            while read_count < length {
                let buf = &mut data[read_count..];
                let n = api::sys_read(fd, buf.as_mut_ptr() as *mut c_void, buf.len());
                if n <= 0 {
                    break;
                }
                read_count += n as usize;
            }

            // Write to mapped memory
            aspace.write(aligned_vaddr, &data[..read_count])?;
        }

        Ok(aligned_vaddr.as_usize())
    })
}
```

### 遇到的问题和解决方案

**问题 1**：`sys_mmap` 的地址对齐问题

**原因**：内存映射需要按页对齐，但用户传入的地址和长度可能不对齐。

**解决**：使用 `align_down_4k()` 和按页对齐长度：`(length + PAGE_SIZE_4K - 1) & !(PAGE_SIZE_4K - 1)`

**问题 2**：文件映射的实现

**问题**：如何将文件内容映射到内存？

**解决**：先读取文件内容到缓冲区，然后使用 `aspace.write()` 写入映射的内存区域。

**问题 3**：虚拟地址分配

**问题**：当 `addr` 为 NULL 时，如何选择合适的虚拟地址？

**解决**：在栈下方分配，计算 `aspace.end() - USER_STACK_SIZE - aligned_length`，确保不与栈冲突。

### 学习感悟

这个练习让我深入理解了系统调用的实现机制。特别是地址空间管理和内存映射，让我对操作系统内核有了更深入的理解。在实现过程中，需要仔细处理地址对齐、权限等问题，这些都是系统编程中需要注意的细节。

---

## 练习六：simple_hv

### 学习过程

这个练习是最复杂的，花了我最多时间。一开始我对虚拟化的概念不太理解，特别是两级地址转换机制，让我困惑了很久。看了很多资料，包括 RISC-V 虚拟化扩展规范，才慢慢理解了。

后来在调试过程中，遇到了很多问题，比如 `htinst` 寄存器不可用、地址转换错误等。好在最后通过看源码和调试，终于理解了。

### 实现

这个练习涉及虚拟化技术的多个核心方面：

1. **客户机镜像加载**：从文件系统加载 ELF 或二进制格式的客户机镜像
2. **地址转换**：实现两级地址转换（GVA → GPA → HPA）
3. **虚拟 CPU 管理**：保存和恢复虚拟 CPU 的寄存器状态
4. **陷阱处理**：处理客户机产生的陷阱，包括非法指令、页面错误、环境调用等

关键点：

- 使用身份映射（GPA = HPA）简化实现
- 禁用 VSATP，让客户机直接使用 GPA
- 通过指令模拟实现特权指令的功能

### 遇到的问题和解决方案

#### 问题 1：地址转换的复杂性

**问题**：最初不理解两级地址转换的工作原理，特别是 VSATP 和 HGATP 的关系。

**原因**：RISC-V H 扩展的地址转换机制比较复杂，需要理解：

- VSATP 将 GVA 转换为 GPA
- HGATP 将 GPA 转换为 HPA
- 两者需要配合工作

**解决**：

- 通过阅读 RISC-V 虚拟化扩展规范理解地址转换流程
- 使用身份映射简化实现
- 在代码中添加详细注释说明地址转换过程

#### 问题 2：htinst 寄存器不可用

**问题**：当 VSATP 禁用时，`htinst` 寄存器可能为 0，无法获取导致非法指令异常的指令。

**原因**：`htinst` 寄存器在某些情况下（如 VSATP 禁用）可能不包含有效信息。

**解决**：

- 检查 `htinst` 是否为 0
- 如果为 0，从 `sepc` 指定的物理地址读取指令
- 使用内核的直接映射将 GPA 转换为 KVA 后读取

#### 问题 3：身份映射的必要性

**问题**：不理解为什么需要为 GPA 创建身份映射。

**原因**：HGATP 使用 GPA 作为虚拟地址来访问页表，因此需要将 GPA 映射到 HPA（在身份映射中，GPA = HPA）。

**解决**：

- 理解 HGATP 的地址转换机制
- 为页表根和入口地址创建身份映射
- 确保 HGATP 可以正确访问页表页面

### 学习感悟

通过这个练习，我深入理解了虚拟化技术的核心原理。特别是两级地址转换机制，让我对 RISC-V H 扩展有了更深入的理解。

在调试过程中，我学会了如何排查虚拟化相关的问题，包括地址转换错误、寄存器状态错误等。这些经验对我理解操作系统内核非常有帮助。

虽然这个练习很复杂，但完成后的成就感也很强。虚拟化是操作系统中最复杂的技术之一，通过这个练习，我对操作系统有了更深入的理解。

---

## 总体学习收获

通过完成这些练习，我学到了很多：

1. **模块化设计**：arceOS 的模块化设计让我印象深刻。通过 feature 标志，可以在编译时选择不同的实现，这种设计非常灵活。

2. **no_std 环境编程**：理解了在无标准库环境下如何实现常用功能。虽然代码量增加了，但这种设计让系统更加可控。

3. **底层系统编程**：深入理解了操作系统核心机制，包括内存管理、进程管理、虚拟化等。这些知识对我理解操作系统内核非常有帮助。

4. **问题解决能力**：在调试过程中，我学会了如何排查系统级问题。特别是通过看源码和调试，理解了很多之前不理解的概念。

5. **Rust 系统编程**：通过实践加深了对 Rust 在系统编程中的应用理解。Rust 的所有权系统和类型安全，让系统编程更加安全。

## 后续思考

arceOS 的模块化设计给我留下了深刻印象。即使是简单的功能，也需要考虑底层实现。这种设计使得每个组件都可以独立测试和替换，为系统开发和调试带来了极大的便利。

通过这次学习，我不仅掌握了操作系统的基本原理，还深入理解了 Rust 在系统编程中的优势。内核的学习实际上最重要的部分可能更是在于解决问题，也就是在针对特定问题的排查思路上。

很感谢这次训练营的主办方，给了这么好的学习机会。虽然学习过程中遇到了很多困难，但完成后的成就感也很强。未来如果有机会，我还会继续深入学习操作系统内核。
