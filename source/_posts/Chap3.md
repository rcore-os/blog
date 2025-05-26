---
title: rcore-handnote-3
date: 2025-04-27 9:40:28
categories: 
    - handnote 
tags:
    - 2025春夏季开源操作系统训练营
---
## Chapter 3

### Introduction

We need to place multiple app to multiple memory address to run app in cycle. Rather run once and clear for next.

First We want to place each app to each isolated addr, due to our kernel restriction, we need to load it with `build.py`.

---

### Task

Task: a workflow process

Define every time slice of **Task** as **Task Slice**

Define the switch between app as **Task switching**

We need to store **Task Context**

Design:
![switch](/rCore-Blog/assets/Lab3-1.png)


We will store these register in ctx:
```rust
// os/src/task/context.rs

pub struct TaskContext {
    ra: usize,
    sp: usize,
    s: [usize; 12],
}
```

```
.altmacro
.macro SAVE_SN n
    sd s\n, (\n+2)*8(a0)
.endm
.macro LOAD_SN n
    ld s\n, (\n+2)*8(a1)
.endm
    .section .text
    .globl __switch
__switch:
...
# logic by store previous context and take out the new one to current register
```

Expose to Rust

```rust
// os/src/task/switch.rs

global_asm!(include_str!("switch.S"));

use super::TaskContext;

extern "C" {
    pub fn __switch(
        current_task_cx_ptr: *mut TaskContext,
        next_task_cx_ptr: *const TaskContext
    );
}
```

We will design `TaskManager`:

- Store each App state array and current running app.
- each state store `TaskContext` and `TaskState` for running or exited etc...
- Init and ready by store the `__restore` ctx to `TaskContext`
- Run for switch cx if needed.

```rust           
let current_task_cx_ptr = &mut inner.tasks[current].task_cx as *mut TaskContext;
let next_task_cx_ptr = &inner.tasks[next].task_cx as *const TaskContext;
drop(inner);
// before this, we should drop local variables that must be dropped manually
unsafe {
	__switch(
		current_task_cx_ptr,
		next_task_cx_ptr,
	);
}rust
```


### Dispatch Design

#### Collaboration

Manually design interface `yield` for App to use

```rust
pub fn sys_yield() -> isize {
    syscall(SYSCALL_YIELD, [0, 0, 0])
}

// user/src/lib.rs

pub fn yield_() -> isize { sys_yield() }
```

But it can be inefficient for some case that app already done its work but reluctant to exit.

#### Preemptive

We will design interrupt clock in a fixed time bound to force switch between app.

- Set timer design and get time
- Set timer for trigger
- enable timer and handle the interrupt cause of Timer in `ecall`

You should know this as a pre-knowledge:

![](/rCore-Blog/assets/Lab3-2.png)

```rust
const SBI_SET_TIMER: usize = 0;

pub fn set_timer(timer: usize) {
    sbi_call(SBI_SET_TIMER, timer, 0, 0);
}

// os/src/timer.rs

use crate::config::CLOCK_FREQ;
const TICKS_PER_SEC: usize = 100;

pub fn set_next_trigger() {
    set_timer(get_time() + CLOCK_FREQ / TICKS_PER_SEC);
}

// os/src/trap/mod.rs

match scause.cause() {
    Trap::Interrupt(Interrupt::SupervisorTimer) => {
        set_next_trigger();
        suspend_current_and_run_next();
    }
}

// enable supervisor clock
// os/src/trap/mod.rs

use riscv::register::sie;

pub fn enable_timer_interrupt() {
    unsafe { sie::set_stimer(); }
}
```