---
title: rcore-handnote-5
date: 2025-04-27 9:40:28
categories: 
    - handnote 
tags:
    - 2025春夏季开源操作系统训练营
---
## Chapter 5

### Introduction

After the demand of code execution one by one, we want to introduce **Process** which will be a full space-time description of execution process of binary file in OS. It means for one process, it should hold independent resources to be executed.

After **Process**, **Thread** and **Coroutine** are also developed in growth of OS. They are different in resources taken up, usually, **Thread** will be in one process and hold their own independent stack and workflow; **Coroutine** will be in one **Thread** and hold their own independent workflow.

---

### Design

Every process need independent memory layout, can be dispatch by cpu. It's the functionality based on **Task**, after that, each process can **Fork** their own children processes, so there's a workflow in time discrepancy. Its resource can't be recycled in time due to children processes, we need to mark it as **Zombie Process**.

To clarify which is children, which is parent, and each isolated process, we mark each with **PID-Process Identifier**. Notice if we fork a process, it will be same as parent only `a0` which is the register called for return will be different, parent process return new PID of child process, child process return 0 as none of fork.

- fork: copy a process state(like `sp` etc...) as its child process.
- waitpid: wait a child become zombie and recycle all resources.
- exec: clear a process state and load a execution file.

---

### Data Constructon

We will recycle all presumed pid by `PidAllocator`, No need to worry about previous pid used.

```rust
pub struct PidHandle(pub usize);

struct PidAllocator {
    current: usize,
    recycled: Vec<usize>,
}

// impl PidAllocator
pub fn alloc(&mut self) -> PidHandle {
	if let Some(pid) = self.recycled.pop() {
		PidHandle(pid)
	} else {
		self.current += 1;
		PidHandle(self.current - 1)
	}
}
```

Therefore, if one pid recycled, it deallocated memory can be reused, we will define its `KernelStack` addr by pid.

```rust
// os/src/task/pid.rs

pub struct KernelStack {
    pid: usize,
}

pub fn kernel_stack_position(app_id: usize) -> (usize, usize) {
    let top = TRAMPOLINE - app_id * (KERNEL_STACK_SIZE + PAGE_SIZE);
    let bottom = top - KERNEL_STACK_SIZE;
    (bottom, top)
}

// impl KernelStack
pub fn push_on_top<T>(&self, value: T) -> *mut T where
	T: Sized, {
	let kernel_stack_top = self.get_top();
	let ptr_mut = (kernel_stack_top - core::mem::size_of::<T>()) as *mut T;
	unsafe { *ptr_mut = value; }
	ptr_mut
}
pub fn get_top(&self) -> usize {
	let (_, kernel_stack_top) = kernel_stack_position(self.pid);
	kernel_stack_top
}

impl Drop for KernelStack {
    fn drop(&mut self) {
        let (kernel_stack_bottom, _) = kernel_stack_position(self.pid);
        let kernel_stack_bottom_va: VirtAddr = kernel_stack_bottom.into();
        KERNEL_SPACE
            .exclusive_access()
            .remove_area_with_start_vpn(kernel_stack_bottom_va.into());
    }
}
```

We need to construct `TaskControlBlock` for parent and children process.

```rust
pub struct TaskControlBlockInner {
	...
	// new:
    pub parent: Option<Weak<TaskControlBlock>>,
    pub children: Vec<Arc<TaskControlBlock>>,
    pub exit_code: i32,
}

// impl TaskControlBlockInner
pub fn is_zombie(&self) -> bool {
	self.get_status() == TaskStatus::Zombie
}
```

`TaskManager` manage all tasks and cpu dispatch, we will separate only tasks management for `TaskManager`.

```rust
// os/src/task/manager.rs

pub struct TaskManager {
    ready_queue: VecDeque<Arc<TaskControlBlock>>,
}

lazy_static! {
    pub static ref TASK_MANAGER: UPSafeCell<TaskManager> = unsafe {
        UPSafeCell::new(TaskManager::new())
    };
}

pub fn add_task(task: Arc<TaskControlBlock>) {
    TASK_MANAGER.exclusive_access().add(task);
}

pub fn fetch_task() -> Option<Arc<TaskControlBlock>> {
    TASK_MANAGER.exclusive_access().fetch()
}
```

And cpu dispatch for newly introduced **Processor**.
We introduce a **idle process** that used to call other process.

- Why not direct call next by previous one? rather use idle process?
- Separate idle process for **start** and others for its own, then dispatch data won't occur in other process and make the dispatch process invisible for **Trap** for each process.

The whole workflow would be:
- idle process fetch task and switch
- task run out of its time or finish
- task switch to idle process
- repeat...

```rust
pub struct Processor {
    current: Option<Arc<TaskControlBlock>>,
	// idle process of current cpu
    idle_task_cx: TaskContext,
}

lazy_static! {
    pub static ref PROCESSOR: UPSafeCell<Processor> = unsafe {
        UPSafeCell::new(Processor::new())
    };
}

// run_tasks() 
// loop to fetch task and switch possible task
if let Some(task) = fetch_task() {
    let idle_task_cx_ptr = processor.get_idle_task_cx_ptr();
    let mut task_inner = task.inner_exclusive_access();
    let next_task_cx_ptr = &task_inner.task_cx as *const TaskContext;
    task_inner.task_status = TaskStatus::Running;
    drop(task_inner);
    processor.current = Some(task);
    drop(processor);
    unsafe {
        __switch(
            idle_task_cx_ptr,
            next_task_cx_ptr,
        );
    }
}

// switch to idle process if one task run out of its time.
pub fn schedule(switched_task_cx_ptr: *mut TaskContext) {
    let mut processor = PROCESSOR.exclusive_access();
    let idle_task_cx_ptr = processor.get_idle_task_cx_ptr();
    drop(processor);
    unsafe {
        __switch(
            switched_task_cx_ptr,
            idle_task_cx_ptr,
        );
    }
}
```

---

### Dispatch Construction

Previously, we use `suspend_current_and_run_next` to pause task and switch to next, now we need to adapt it to process design.

```rust
// os/src/task/mod.rs

pub fn suspend_current_and_run_next() {
    let task = take_current_task().unwrap();

    // ---- access current TCB exclusively
    let mut task_inner = task.inner_exclusive_access();
    let task_cx_ptr = &mut task_inner.task_cx as *mut TaskContext;
    task_inner.task_status = TaskStatus::Ready;
    drop(task_inner);
    // ---- stop exclusively accessing current PCB

    // add to task deque
    add_task(task);
    // change current to idle process
    schedule(task_cx_ptr);
}
```

In previous case, task won't be created by its parent task, but process will. So, if its `TrapContext` has been recycled, we need to refactor our `trap_handler` for such case.

```rust
// fn trap_handler() -> !
Trap::Exception(Exception::UserEnvCall) => {
    // jump to next instruction anyway
    let mut cx = current_trap_cx();
    cx.sepc += 4;
    // syscall may create new process and change trap context.
    let result = syscall(cx.x[17], [cx.x[10], cx.x[11], cx.x[12]]);
    // wether cx is changed or not, we will refetch it.
    cx = current_trap_cx();
    cx.x[10] = result as usize;
}
```

---

Now we will construct `fork`, `exec`, `waitpid`,`exit`.

#### Fork

We need to copy all memory layout and its task state. Then reallocate new kernel stack for it.

```rust
// impl MemorySet
pub fn from_existed_user(user_space: &MemorySet) -> MemorySet {
    let mut memory_set = Self::new_bare();
    // map trampoline
    memory_set.map_trampoline();
    // copy data sections/trap_context/user_stack
    for area in user_space.areas.iter() {
        let new_area = MapArea::from_another(area);
        memory_set.push(new_area, None);
        // copy data from another space
        for vpn in area.vpn_range {
            let src_ppn = user_space.translate(vpn).unwrap().ppn();
            let dst_ppn = memory_set.translate(vpn).unwrap().ppn();
            dst_ppn.get_bytes_array().copy_from_slice(src_ppn.get_bytes_array());
        }
    }
    memory_set
}

// impl TaskControlBlock
// fn fork
let trap_cx_ppn = memory_set
    .translate(VirtAddr::from(TRAP_CONTEXT).into())
    .unwrap()
    .ppn();
// alloc a pid and a kernel stack in kernel space
let pid_handle = pid_alloc();
let kernel_stack = KernelStack::new(&pid_handle);
let kernel_stack_top = kernel_stack.get_top();
let task_control_block = Arc::new(TaskControlBlock {
    pid: pid_handle,
    kernel_stack,
    inner: unsafe { UPSafeCell::new(TaskControlBlockInner {
        trap_cx_ppn,
        base_size: parent_inner.base_size,
        task_cx: TaskContext::goto_trap_return(kernel_stack_top),
        task_status: TaskStatus::Ready,
        memory_set,
        parent: Some(Arc::downgrade(self)),
        children: Vec::new(),
        exit_code: 0,
    })},
});
// add child
parent_inner.children.push(task_control_block.clone());
// modify kernel_sp in trap_cx
// **** access children PCB exclusively
let trap_cx = task_control_block.inner_exclusive_access().get_trap_cx();
trap_cx.kernel_sp = kernel_stack_top;
```

Finally, implement `sys_fork`

```rust
pub fn sys_fork() -> isize {
    let current_task = current_task().unwrap();
    let new_task = current_task.fork();
    let new_pid = new_task.pid.0;
    let trap_cx = new_task.inner_exclusive_access().get_trap_cx();

    // for child process, fork returns 0
    trap_cx.x[10] = 0;  //x[10] is a0 reg

    add_task(new_task);
    new_pid as isize
}
```

We can see that if `trap_handler` call `sys_fork`, parent process `x[10]` would be `new_pid` as return value.

#### Exec

If we want to execute a task by its name, we need to first load string in app load.

```rust
// os/build.rs

writeln!(f, r#"
.global _app_names
_app_names:"#)?;
for app in apps.iter() {
    writeln!(f, r#"    .string "{}""#, app)?;
}

```
```
# link_app.S

...
_app_names:
    .string "exit"
    .string "fantastic_text"
...
```

Construct `APP_NAMES` as global state in OS.
```rust
// os/src/loader.rs

// APP_NAMES: Vec<&'static str> {...
for _ in 0..num_app {
    let mut end = start;
    while end.read_volatile() != '\0' as u8 {
        end = end.add(1);
    }
    let slice = core::slice::from_raw_parts(start, end as usize - start as usize);
    let str = core::str::from_utf8(slice).unwrap();
    v.push(str);
    start = end.add(1);
}
```

When execute a new binary file, we need to read it and extract all state to replace original one.

```rust
// os/src/task/task.rs

impl TaskControlBlock {
    pub fn exec(&self, elf_data: &[u8]) {
        let (memory_set, user_sp, entry_point) = MemorySet::from_elf(elf_data);
        let trap_cx_ppn = memory_set
            .translate(VirtAddr::from(TRAP_CONTEXT).into())
            .unwrap()
            .ppn();

        // **** access inner exclusively
        let mut inner = self.inner_exclusive_access();
        inner.memory_set = memory_set;
        inner.trap_cx_ppn = trap_cx_ppn;

        let trap_cx = inner.get_trap_cx();
        *trap_cx = TrapContext::app_init_context(
            entry_point,
            user_sp,
            KERNEL_SPACE.exclusive_access().token(),
            self.kernel_stack.get_top(),
            trap_handler as usize,
        );
        // **** stop exclusively accessing inner automatically
    }
}
```

We will read input `str` as a ptr and replace current task state.

```rust
// os/src/syscall/process.rs

pub fn sys_exec(path: *const u8) -> isize {
    let token = current_user_token();
    let path = translated_str(token, path);
    if let Some(data) = get_app_data_by_name(path.as_str()) {
        let task = current_task().unwrap();
        task.exec(data);
        0
    } else {
        -1
    }
}
```

#### Exit

When a task exit, it will return a **exit code** assigned by app if successfully or kernel if anomaly.

```rust
// fn exit_current_and_run_next(exit_code:i32)
    inner.task_status = TaskStatus::Zombie;
    inner.exit_code = exit_code;

    // move all its children to the initial process
    // ++++++ access initproc TCB exclusively
    {
        let mut initproc_inner = INITPROC.inner_exclusive_access();
        for child in inner.children.iter() {
            child.inner_exclusive_access().parent = Some(Arc::downgrade(&INITPROC));
            initproc_inner.children.push(child.clone());
        }
    }
    // ++++++ stop exclusively accessing parent PCB

    // clear all memory.
    inner.children.clear();
    inner.memory_set.recycle_data_pages();
    drop(inner);
    // **** stop exclusively accessing current PCB
    // drop task manually to maintain rc correctly
    drop(task);
    // use _unused replace original context, which will be recycled by rust.
    let mut _unused = TaskContext::zero_init();
    schedule(&mut _unused as *mut _);

// os/src/syscall/process.rs

pub fn sys_exit(exit_code: i32) -> ! {
    exit_current_and_run_next(exit_code);
    panic!("Unreachable in sys_exit!");
}
```

#### WaitPid

WaitPid will return `-1` if there's no specified pid process exist, if it's running, return `-2`, finally, if it finished, recycle it and return `0`.

```rust
// sys_waitpid(pid:uisze, exit_code_ptr:*mut i32) -> isize

// -1 case
// search task manager and find (task_block)
|p| {pid == -1 || pid as usize == p.getpid()}
return -1;

let pair = // search task managers and find (idx,task_block)
p.inner_exclusive_access().is_zombie() && (pid == -1 || pid as usize == p.getpid())

if let Some((idx,_)) = pair {
    let child = inner.children.remove(idx);
    // confirm that child will be deallocated after removing from children list
    assert_eq!(Arc::strong_count(&child), 1);
    let found_pid = child.getpid();
    // ++++ temporarily access child TCB exclusively
    let exit_code = child.inner_exclusive_access().exit_code;
    // ++++ stop exclusively accessing child PCB
    *translated_refmut(inner.memory_set.token(), exit_code_ptr) = exit_code;
    found_pid as isize
} else {
    // pid process is running
    -2
}

// user/src/lib.rs

pub fn wait(exit_code: &mut i32) -> isize {
    loop {
        match sys_waitpid(-1, exit_code as *mut _) {
            -2 => { yield_(); }
            // -1 or a real pid
            exit_pid => return exit_pid,
        }
    }
}
```


















