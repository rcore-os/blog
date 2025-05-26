---
title: rcore-handnote-1
date: 2025-04-27 9:40:28
categories: 
    - handnote 
tags:
    - 2025春夏季开源操作系统训练营
---
## Chapter 1

### Execution Environment

![Execution Environment](/rCore-Blog/assets/lab1-1.png)

The execution environment is defined by the **Target Triplet**, which specifies the platform, CPU architecture, and library required for the build. For example: `x86_64-unknown-linux-gnu`.

**Components of the Target Triplet:**
- **Platform**: The specific operating system or runtime environment.
- **CPU Architecture**: The underlying hardware architecture (e.g., x86_64, ARM).
- **Library**: The standard library or runtime support required.

If the target platform contains no `std` or any support syscall, such platform called **bare-metal**, `Rust` contains a `core` lib independent of any platform support.

If we change `.cargo/config` s.t.:
```toml
# os/.cargo/config
[build]
target = "riscv64gc-unknown-none-elf"
```
it called **cross compile** because the running platform is different form execution platform.

#### *No Std* and *No Main*

The basic functionality provided by `std` and `start` semantic is `panic_handler` and `main` entry. 

To toggle it off with:
```rust
#![no_std]
#![no_main]
```

#### RISCV

As for riscv, thing will be tough in here, we need to complete our own entry point, exit, and basic functionality like `print/println`. 

First, we need to define `linker` and `entry` for stack allocation.

Linker:
```bash
# os/src/linker.ld
OUTPUT_ARCH(riscv)
ENTRY(_start) # entry point
BASE_ADDRESS = 0x80200000; # base addr for entry

SECTIONS
...
```

Stack Space:
```bash
# os/src/entry.asm
    .section .text.entry
    .globl _start
_start:
    la sp, boot_stack_top
    call rust_main # call rust_main function as entry 

    .section .bss.stack
    .globl boot_stack_lower_bound
boot_stack_lower_bound:
    .space 4096 * 16
    .globl boot_stack_top
boot_stack_top:
```

For riscv, we need to call `RustSBI`(a underlying specification for rust in riscv).

After implement `sbi_call`, we could construct `put_char`:
```rust
const SBI_CONSOLE_PUTCHAR: usize = 1;

fn sbi_call(...) -> usize {
	...
}

pub fn console_putchar(c:usize) {
	sbi_call(SBI_CONSOLE_PUTCHAR,c,0,0)
}
```

With a formal interface for `write`:
```rust
struct Stdout;

impl Write for Stdout {
    fn write_str(&mut self, s: &str) -> fmt::Result {
        for c in s.chars() {
            console_putchar(c as usize);
        }
        Ok(())
    }
}

pub fn print(args: fmt::Arguments) {
    Stdout.write_fmt(args).unwrap();
}
```

Now we construct basic functionality in `println`, you could also handle `panic_handler` and others...


