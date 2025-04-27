---
title: rcore-handnote-7-2
date: 2025-04-27 9:40:28
categories: 
    - handnote 
tags:
    - 2025春夏季开源操作系统训练营
---
## Chapter 7-2

### Introduction

If a process want to notify other process with event semantics, such one-side mechanism called **Signal**, one process received specific event will pause and implement corresponding operation to handle the notification.

For example, a program could receive the stop event sended by `Ctrl+C`, and stop itself.

The abstraction of handling of signal:
- ignore: do own thing and ignore signal
- trap: call corresponding operation of the received signal
- stop: stop itself

Now, beside this raw idea, we want to classify such abstraction with specified data.

---

### Signal Data

First, we define raw info for each possible event.

```rust
// user/src/lib.rs

pub const SIGDEF: i32 = 0; // Default signal handling
pub const SIGHUP: i32 = 1;
pub const SIGINT: i32 = 2;
pub const SIGQUIT: i32 = 3;
pub const SIGILL: i32 = 4;
pub const SIGTRAP: i32 = 5;
pub const SIGABRT: i32 = 6;
pub const SIGBUS: i32 = 7;
pub const SIGFPE: i32 = 8;
pub const SIGKILL: i32 = 9;
...
```

So, what if a process want to omit the signal, what should this process do? We will introduce **Mask** in bit design, which means higher number contains lower number, indicating higher priority.

```rust
// user/src/lib.rs

bitflags! {
    pub struct SignalFlags: i32 {
        const SIGDEF = 1; // Default signal handling
        const SIGHUP = 1 << 1;
        const SIGINT = 1 << 2;
        const SIGQUIT = 1 << 3;
        const SIGILL = 1 << 4;
        const SIGTRAP = 1 << 5;
        ...
        const SIGSYS = 1 << 31;
    }
}
```

In a task block, it should record its current mask and current signal priority and each action corresponding to each flags, so we need a fixed array contains ptrs and its priority. After that, we need to record current flag it should implement.

```rust
// user/src/lib.rs

/// Action for a signal
#[repr(C, align(16))]
#[derive(Debug, Clone, Copy)]
pub struct SignalAction {
    pub handler: usize,
    pub mask: SignalFlags,
}

// os/src/task/signal.rs

pub const MAX_SIG: usize = 31;

// os/src/task/action.rs

#[derive(Clone)]
pub struct SignalActions {
    pub table: [SignalAction; MAX_SIG + 1],
}

// os/src/task/task.rs

pub struct TaskControlBlockInner {
    ...
	pub handling_sig: isize,
	// priority allowed
	pub signals: SignalFlags,
	// priority forbidden
    pub signal_mask: SignalFlags,
    pub signal_actions: SignalActions,
    ...
}
```

Then our task know which signal should be implemented, which should be omitted.

---

### Signal Handle

Recall that, each process should receive signal and trap into possible level, some may be in S-level, some may be in U-level. And some of them may be illegal or atrocious that we should `stop` or `frozen` to wait. If so, we should backup our `trap_ctx`, because handler contains different environement.

```rust
// os/src/task/task.rs

pub struct TaskControlBlockInner {
    ...
	pub killed: bool,
    pub frozen: bool,
    pub handling_sig: isize,
    pub trap_ctx_backup: Option<TrapContext>,
    ...
}

// os/src/task/mod.rs

// Some signals are severe and handled by kernel.
fn call_kernel_signal_handler(signal: SignalFlags) {
    let task = current_task().unwrap();
    let mut task_inner = task.inner_exclusive_access();
    match signal {
        SignalFlags::SIGSTOP => {
            task_inner.frozen = true;
            task_inner.signals ^= SignalFlags::SIGSTOP;
        }
        SignalFlags::SIGCONT => {
            if task_inner.signals.contains(SignalFlags::SIGCONT) {
                task_inner.signals ^= SignalFlags::SIGCONT;
                task_inner.frozen = false;
            }
        }
        _ => {
            // println!(
            //     "[K] call_kernel_signal_handler:: current task sigflag {:?}",
            //     task_inner.signals
            // );
            task_inner.killed = true;
        }
    }
}

// Some signals are normal and handled by user.
fn call_user_signal_handler(sig: usize, signal: SignalFlags) {
    let task = current_task().unwrap();
    let mut task_inner = task.inner_exclusive_access();

    let handler = task_inner.signal_actions.table[sig].handler;
    if handler != 0 {
		// register signal into task
        task_inner.handling_sig = sig as isize;
        task_inner.signals ^= signal;

		// backup
        let mut trap_ctx = task_inner.get_trap_cx();
        task_inner.trap_ctx_backup = Some(*trap_ctx);

		// modify current trap for our event handler
        trap_ctx.sepc = handler;
        trap_ctx.x[10] = sig;
    } else {
        // default action
        println!("[K] task/call_user_signal_handler: default action: ignore it or kill process");
    }
}
```

Based on this, we could check our pending signal based on priority of `signals`, `signal_mask` of task and `signal_mask` of signal itself of table.

```rust
// os/src/task/mod.rs

fn check_pending_signals() {
    for sig in 0..(MAX_SIG + 1) {
        let task = current_task().unwrap();
        let task_inner = task.inner_exclusive_access();
        let signal = SignalFlags::from_bits(1 << sig).unwrap();
        if task_inner.signals.contains(signal) && (!task_inner.signal_mask.contains(signal)) {
            let mut masked = true;
            let handling_sig = task_inner.handling_sig;
            if handling_sig == -1 {
                masked = false;
            } else {
                let handling_sig = handling_sig as usize;
                if !task_inner.signal_actions.table[handling_sig]
                    .mask
                    .contains(signal)
                {
                    masked = false;
                }
            }
            if !masked {
                drop(task_inner);
                drop(task);
                if signal == SignalFlags::SIGKILL
                    || signal == SignalFlags::SIGSTOP
                    || signal == SignalFlags::SIGCONT
                    || signal == SignalFlags::SIGDEF
                {
                    // signal is a kernel signal
                    call_kernel_signal_handler(signal);
                } else {
                    // signal is a user signal
                    call_user_signal_handler(sig, signal);
                    return;
                }
            }
        }
    }
}
```

Then record a loop function to handle repeatedly while changing the state of task.

```rust
// os/src/task/mod.rs

pub fn handle_signals() {
    loop {
        check_pending_signals();
        let (frozen, killed) = {
            let task = current_task().unwrap();
            let task_inner = task.inner_exclusive_access();
            (task_inner.frozen, task_inner.killed)
        };
        if !frozen || killed {
            break;
        }
        suspend_current_and_run_next();
    }
}
```

---

### System Operation

Finally, we will design `sys` operations to construct interface.

- procmask: set mask of current process
- sigaction: set handler of a signal of current process and move original handler to our input `old_action` ptr.
- kill: current process send signal to the other
- sigreturn: clear current signal and back to original trap state

We will construct it one by one.

`procmask` is simple, we just set it directly and return original one.
```rust
// os/src/process.rs

pub fn sys_sigprocmask(mask: u32) -> isize {
    if let Some(task) = current_task() {
        let mut inner = task.inner_exclusive_access();
        let old_mask = inner.signal_mask;
        if let Some(flag) = SignalFlags::from_bits(mask) {
            inner.signal_mask = flag;
            old_mask.bits() as isize
        } else {
            -1
        }
    } else {
        -1
    }
}
```

`sigaction` is a bit harder but still easy, however, notice that the ptr may be null.

```rust
// os/src/syscall/process.rs

fn check_sigaction_error(signal: SignalFlags, action: usize, old_action: usize) -> bool {
    if action == 0
        || old_action == 0
        || signal == SignalFlags::SIGKILL
        || signal == SignalFlags::SIGSTOP
    {
        true
    } else {
        false
    }
}

pub fn sys_sigaction(
    signum: i32,
    action: *const SignalAction,
    old_action: *mut SignalAction,
) -> isize {
    let token = current_user_token();
    let task = current_task().unwrap();
    let mut inner = task.inner_exclusive_access();
    if signum as usize > MAX_SIG {
        return -1;
    }
    if let Some(flag) = SignalFlags::from_bits(1 << signum) {
        if check_sigaction_error(flag, action as usize, old_action as usize) {
            return -1;
        }
        let prev_action = inner.signal_actions.table[signum as usize];
        *translated_refmut(token, old_action) = prev_action;
        inner.signal_actions.table[signum as usize] = *translated_ref(token, action);
        0
    } else {
        -1
    }
}
```

`kill` is simple, we will extract the task from `pid`, and insert flag to it if there's no flag has been set.

```rust
// os/src/syscall/process.rs

fn check_sigaction_error(signal: SignalFlags, action: usize, old_action: usize) -> bool {
    if action == 0
        || old_action == 0
        || signal == SignalFlags::SIGKILL
        || signal == SignalFlags::SIGSTOP
    {
        true
    } else {
        false
    }
}

pub fn sys_sigaction(
    signum: i32,
    action: *const SignalAction,
    old_action: *mut SignalAction,
) -> isize {
    let token = current_user_token();
    let task = current_task().unwrap();
    let mut inner = task.inner_exclusive_access();
    if signum as usize > MAX_SIG {
        return -1;
    }
    if let Some(flag) = SignalFlags::from_bits(1 << signum) {
        if check_sigaction_error(flag, action as usize, old_action as usize) {
            return -1;
        }
        let prev_action = inner.signal_actions.table[signum as usize];
        *translated_refmut(token, old_action) = prev_action;
        inner.signal_actions.table[signum as usize] = *translated_ref(token, action);
        0
    } else {
        -1
    }
}
```

`sigreturn` is simple, because we only need to restore our backup one.

```rust
// os/src/syscall/process.rs

pub fn sys_sigreturn() -> isize {
    if let Some(task) = current_task() {
        let mut inner = task.inner_exclusive_access();
        inner.handling_sig = -1;
        // restore the trap context
        let trap_ctx = inner.get_trap_cx();
        *trap_ctx = inner.trap_ctx_backup.unwrap();
        0
    } else {
        -1
    }
}
```

Phew! We finish our **Signal** mechanism!