---
title: rcore-handnote-2
date: 2025-04-27 9:40:28
categories: 
    - handnote 
tags:
    - 2025春夏季开源操作系统训练营
---
## Chapter 2

### Introduction 

![Introduction](/rCore-Blog/assets/Lab2-1.png)

It corresponds to `riscv`:
- Privilege for `S`(guaranteed by `Supervisor Execution Environment` of `RustSBI`)
- User for `U`(constructed in current chapter as `Application Execution Environment`)

Reason:
- Safety(Prevent app from accessing kernel)
- Recoverable

Workflow:
- Start application and user-mode context
- **Trap**(Called by system level) to handle system
	- Goes wrong! Kill it!
	- Finish! Next!
- **Restore** to user-mode context

`riscv` designs following `CSR`(Control and Status Register) to handle this:

### CSR

![CSR](/rCore-Blog/assets/Lab2-2.png)

Begin **Trap**:
- sstatus: `SPP` seg to the current level of CPU.
- sepc: next addr after Trap finished.
- scause/stval: Trap cause and additional info.
- stvec: storage of entry addr of Trap

> **stvec** is a 64-bit CSR, with:
> - MODE(Direct/Vectored) `[1:0]`(read from right to left): 2-bits
> - BASE `[63:2]`: 62-bits

finally, it will return by instruction `sret` which will change level and jump by `sepc`.

### Construct Trap

Design:
- General register will be shared by U-level and S-level.
- Maintain a reasonable state of `CSR`.
- Separate workflow of U-level and S-level by stack

Construct:
- build `KernelStack` and `UserStack` for separation
- in `KernelStack`, we store `TrapContext` in it, by asm and rust to control dispatch and handle, then store the code to `stvec` as the entry of Trap.
- restore register for `UserStack` by push a new context refer to `UserStack`.

build stack and push context:
```rust
// stack struct ...

// buttom to top
fn get_sp(&self) -> usize {
    self.data.as_ptr() as usize + KERNEL_STACK_SIZE
}
pub fn push_context(&self, cx: TrapContext) -> &'static mut TrapContext {
    let cx_ptr = (self.get_sp() - core::mem::size_of::<TrapContext>()) as *mut TrapContext;
    unsafe {
        *cx_ptr = cx;
    }
    unsafe { cx_ptr.as_mut().unwrap() }
}
```

```rust
// os/src/trap/context.rs

#[repr(C)]
pub struct TrapContext {
    pub x: [usize; 32], // General register
    pub sstatus: Sstatus,
    pub sepc: usize,
}
/// set stack pointer to x_2 reg (sp)
pub fn set_sp(&mut self, sp: usize) {
    self.x[2] = sp;
}
/// init app context
pub fn app_init_context(entry: usize, sp: usize) -> Self {
    let mut sstatus = sstatus::read(); // CSR sstatus
    sstatus.set_spp(SPP::User); //previous privilege mode: user mode
    let mut cx = Self {
        x: [0; 32],
        sstatus,
        sepc: entry, // entry point of app
    };
    cx.set_sp(sp); // app's user stack pointer
    cx // return initial Trap Context of app
}
```

We will design `__alltrap` and `__restore` for operation by asm and part of rust:

``` 
.altmacro
.macro SAVE_GP n
    sd x\n, \n*8(sp)
.endm
.macro LOAD_GP n
    ld x\n, \n*8(sp)
.endm
.align_2
__alltraps:
    ...
# set input argument of trap_handler(cx: &mut TrapContext)
    mv a0, sp # sp is point to TrapContext in kernel stack
    call trap_handler # (&mut TrapContext)

--restore:
    ...
```

To handle Trap context, we will use `riscv` lib:
```rust
// os/Cargo.toml

[dependencies]
riscv = { git = "https://github.com/rcore-os/riscv", features = ["inline-asm"] }

// os/src/trap/mod.rs
global_asm!(include_str!("trap.S"));

pub fn init() {
    extern "C" { fn __alltraps(); }
    // write to stvec
    unsafe {
        stvec::write(__alltraps as usize, TrapMode::Direct);
    }
}

#[no_mangle]
pub fn trap_handler(cx: &mut TrapContext) -> &mut TrapContext {
    ...
}
```

restore operation:

```rust
extern "C" { fn __restore(cx_addr: usize); }
unsafe {
    __restore(KERNEL_STACK.push_context(
        TrapContext::app_init_context(APP_BASE_ADDRESS, USER_STACK.get_sp())
// This context store the ptr to UserStack for restoration
    ) as *const _ as usize);
} 
```

### Construct User App

- Link app binary to kernel with specify memory layout
- Read the layout, use `AppManager` to maintain and store
- Load app from memory layout, copy consecutively to `APP_BASE_ADDRESS`(Currently we have no ability to dynamically read address)
- AppManager will run each app

```
# os/src/link_app.S

    .align 3
    .section .data
    .global _num_app # read from the ptr
_num_app:
    .quad 5
    .quad app_0_start
    .quad app_1_start
    .quad app_2_start
    .quad app_3_start
    .quad app_4_start
    .quad app_4_end`

...
```

Design it!
```rust
// os/src/batch.rs

struct AppManager {
    num_app: usize,
    current_app: usize,
    app_start: [usize; MAX_APP_NUM + 1],
}

// part of read in static init of AppManager
let num_app_ptr = _num_app as usize as *const usize;
let num_app = num_app_ptr.read_volatile();
let mut app_start: [usize; MAX_APP_NUM + 1] = [0; MAX_APP_NUM + 1];
let app_start_raw: &[usize] =  core::slice::from_raw_parts(
    num_app_ptr.add(1), num_app + 1
);
app_start[..=num_app].copy_from_slice(app_start_raw);
```

Load App:
```rust
// part of code of copying to kernel
asm!("fence.i");
// clear app area
core::slice::from_raw_parts_mut(
    APP_BASE_ADDRESS as *mut u8,
    APP_SIZE_LIMIT
).fill(0);
let app_src = core::slice::from_raw_parts(
    self.app_start[app_id] as *const u8,
    self.app_start[app_id + 1] - self.app_start[app_id]
);
let app_dst = core::slice::from_raw_parts_mut(
    APP_BASE_ADDRESS as *mut u8,
    app_src.len()
);
app_dst.copy_from_slice(app_src);
```

Run each app!
```rust
// os/src/batch.rs

pub fn run_next_app() -> ! {
    let mut app_manager = APP_MANAGER.exclusive_access();
    let current_app = app_manager.get_current_app();
    unsafe {
        app_manager.load_app(current_app);
    }
    app_manager.move_to_next_app();
    drop(app_manager);
    // before this we have to drop local variables related to resources manually
    // and release the resources
    extern "C" { fn __restore(cx_addr: usize); }
    unsafe {
        __restore(KERNEL_STACK.push_context(
            TrapContext::app_init_context(APP_BASE_ADDRESS, USER_STACK.get_sp())
        ) as *const _ as usize);
    }
    panic!("Unreachable in batch::run_current_app!");
}

// main logic:
// os/src/main.rs

...above code
// load entry for trap
trap::init()
// load app
batch::run_next_app()
```

