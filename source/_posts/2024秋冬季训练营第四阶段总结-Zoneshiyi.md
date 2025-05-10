---
title: 2024秋冬季训练营第四阶段总结-Zoneshiyi
date: 2024-12-19 19:45:08
tags:
    - author: Zoneshiyi
---
# mocklibc

## ELF结构

### ELF Header
描述整个文件的组织。
``` Rust
pub struct Elf32_Ehdr {
    // Magic、Class（32-bit vs 64-bit）、Data（2's complement、endian）、ELF Version、OS/ABI、ABI Version
    pub e_ident: [u8; abi::EI_NIDENT],
    // Relocatable file、Executable file、Shared object file、Core file
    pub e_type: u16,
    // CPU 平台属性
    pub e_machine: u16,
    // ELF 版本号，通常为1
    pub e_version: u32,
    pub e_entry: u32,
    pub e_phoff: u32,
    pub e_shoff: u32,
    pub e_flags: u32,
    // Size of elf header
    pub e_ehsize: u16,
    // Size of ph entry
    pub e_phentsize: u16,
    // Number of ph
    pub e_phnum: u16,
    // Size of sh entry
    pub e_shentsize: u16,
    // Number of ph
    pub e_shnum: u16,
    // Section header string table index
    pub e_shstrndx: u16,
}

pub struct Elf64_Ehdr {
    ...
    pub e_entry: u64,
    pub e_phoff: u64,
    pub e_shoff: u64,
    ...
}
```

### Sections 和 Segments
segments是从运行的角度来描述elf文件，sections是从链接的角度来描述elf文件，在链接阶段，可以忽略program header table来处理此文件，在运行阶段可以忽略section header table来处理此程序（所以很多加固手段删除了section header table）。一个segment包含若干个section。
#### Program Header Table
描述文件中的各种segments，用来告诉系统如何创建进程映像的。
```Rust
pub struct ProgramHeader {
    /// Program segment type
    pub p_type: u32,
    /// Offset into the ELF file where this segment begins
    pub p_offset: u64,
    /// Virtual adress where this segment should be loaded
    pub p_vaddr: u64,
    /// Physical address where this segment should be loaded
    pub p_paddr: u64,
    /// Size of this segment in the file
    pub p_filesz: u64,
    /// Size of this segment in memory
    pub p_memsz: u64,
    /// Flags for this segment
    pub p_flags: u32,
    /// file and memory alignment
    pub p_align: u64,
}
```
**p_type**
```Rust
/// Program header table entry unused
pub const PT_NULL: u32 = 0;
/// Loadable program segment
pub const PT_LOAD: u32 = 1;
/// Dynamic linking information
pub const PT_DYNAMIC: u32 = 2;
/// Program interpreter
pub const PT_INTERP: u32 = 3;
/// Auxiliary information
pub const PT_NOTE: u32 = 4;
/// Unused
pub const PT_SHLIB: u32 = 5;
/// The program header table
pub const PT_PHDR: u32 = 6;
/// Thread-local storage segment
pub const PT_TLS: u32 = 7;
/// GCC .eh_frame_hdr segment
pub const PT_GNU_EH_FRAME: u32 = 0x6474e550;
/// Indicates stack executability
pub const PT_GNU_STACK: u32 = 0x6474e551;
/// Read-only after relocation
pub const PT_GNU_RELRO: u32 = 0x6474e552;
/// The segment contains .note.gnu.property section
pub const PT_GNU_PROPERTY: u32 = 0x6474e553;
/// Values between [PT_LOOS, PT_HIOS] in this inclusive range are reserved for
/// operating system-specific semantics.
pub const PT_LOOS: u32 = 0x60000000;
/// Values between [PT_LOOS, PT_HIOS] in this inclusive range are reserved for
/// operating system-specific semantics.
pub const PT_HIOS: u32 = 0x6fffffff;
/// Values between [PT_LOPROC, PT_HIPROC] in this inclusive range are reserved
/// for processor-specific semantics.
pub const PT_LOPROC: u32 = 0x70000000;
/// Values between [PT_LOPROC, PT_HIPROC] in this inclusive range are reserved
/// for processor-specific semantics.
pub const PT_HIPROC: u32 = 0x7fffffff;
```
#### Section Header Table
```Rust
pub struct SectionHeader {
    /// Section Name,对应字符串在string table段中的偏移
    pub sh_name: u32,
    /// Section Type
    pub sh_type: u32,
    /// Section Flags
    pub sh_flags: u64,
    /// in-memory address where this section is loaded
    pub sh_addr: u64,
    /// Byte-offset into the file where this section starts
    pub sh_offset: u64,
    /// Section size in bytes
    pub sh_size: u64,
    /// Defined by section type
    pub sh_link: u32,
    /// Defined by section type
    pub sh_info: u32,
    /// address alignment
    pub sh_addralign: u64,
    /// size of an entry if section data is an array of entries
    pub sh_entsize: u64,
}
```

## 自定义加载ELF

### 静态链接

**编译选项：**
```bash
STATIC_FLAG = \
-nostdlib \
-nostartfiles \
-nodefaultlibs \
-ffreestanding \
-O0 \
-mcmodel=medany \
-static \
-no-pie \
-L./target/riscv64gc-unknown-linux-musl/release/ -lmocklibc

riscv64-linux-musl-gcc hello.c $(STATIC_FLAG) -o hello
```

静态编译的可执行文件加载比较简单，直接将其加载到内存中的一块连续空间即可。

唯一要注意的是同时开启`-static`和`-no-pie`选项才能生产类型为EXEC (Executable file)的ELF文件，同时还需要通过linker.ld链接脚本正确设置起始地址。

### 动态链接

**编译选项：**
```bash
DYNAMIC_FLAG = \
-nostdlib \
-nostartfiles \
-nodefaultlibs \
-ffreestanding \
-O0 \
-mcmodel=medany \
-L./target/riscv64gc-unknown-linux-musl/release/ -lmocklibc

riscv64-linux-musl-gcc hello.c $(DYNAMIC_FLAG) -o hello -Wl,-dynamic-linker /path/to/ld-musl-riscv64.so.1

```

linux加载动态链接的可执行文件流程比较复杂，一方面是系统在执行应用前有很多额外的处理，另一方面是加载器本身不提供函数，需要加载一系列的动态链接库。而在我们当前的Unikernel框架下，并不存在动态链接库，系统启动时所有函数都加载到了内存中，因此可以大幅简化加载流程。

首先解析program header将elf文件中类型为PT_LOAD的segment加载到内存中，然后解析.dynsym、.rela.plt节的信息可以知道需要动态链接的函数名，以及重定位条目在内存中的位置。在内核中建立了函数名到对于函数地址的映射，根据这些信息修改重定位条目就能让程序正确执行。
