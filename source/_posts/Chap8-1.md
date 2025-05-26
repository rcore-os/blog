---
title: rcore-handnote-8-1
date: 2025-04-27 9:40:28
categories: 
    - handnote 
tags:
    - 2025春夏季开源操作系统训练营
---
## Chapter 8-1

### Introduction

As the growth of OS, dispatch resource could be divided to smaller piece for more efficient operations. Now, process can't satisfied our demand, we want some programs could be implemented in parallel. Then, we introduce **Thread**.

Therefore, process will be the container of threads, each threads contain its `id`, `state`, current instruction ptr, registers, stack. However, it will share data(which means same memory and addr) in the same process. So, we will develop a accompany exclusion mechanism for parallel operations by each threads.

### Design Data

Now, clarify our resource dispatch for one thread:

Immutable:
- kernel stack

Mutable:
- thread id
- user stack
- trap context
- trap status
- exit code

Every tasks is a thread unit and contained in one process, so now, process is really a process rather a task, it can owns many tasks.

```rust
// os/src/task/process.rs

pub struct ProcessControlBlock {
    // immutable
    pub pid: PidHandle,
    // mutable
    inner: UPSafeCell<ProcessControlBlockInner>,
}

pub struct ProcessControlBlockInner {
	// ...
	pub task_res_allocator: RecycleAllocator,
    pub tasks: Vec<Option<Arc<TaskControlBlock>>>,
}
```

Notice, we should separate user stack and kernel stack, we shouldn't allocate user stack and kernel stack by same logic. Kernel stack is immutable, we only need its top place for trap context.

![](/rCore-Blog/assets/Lab8-1.png)

Because every thread use the same memory set, so each user stack and its trampoline would be allocated by its thread id. We encapsulate these to `TaskUserRes` data.

We can see many structure need a id allocation, we could design a general id allocator.

```rust
// os/src/task/id.rs

pub struct RecycleAllocator {
    current: usize,
    recycled: Vec<usize>,
}

impl RecycleAllocator {
    pub fn new() -> Self {
        RecycleAllocator {
            current: 0,
            recycled: Vec::new(),
        }
    }
    pub fn alloc(&mut self) -> usize {
        if let Some(id) = self.recycled.pop() {
            id
        } else {
            self.current += 1;
            self.current - 1
        }
    }
    pub fn dealloc(&mut self, id: usize) {
        assert!(id < self.current);
        assert!(
            !self.recycled.iter().any(|i| *i == id),
            "id {} has been deallocated!",
            id
        );
        self.recycled.push(id);
    }
}
```

---

#### Kernel Stack Allocation

```rust
// os/src/task/id.rs

lazy_static! {
    static ref KSTACK_ALLOCATOR: UPSafeCell<RecycleAllocator> =
        unsafe { UPSafeCell::new(RecycleAllocator::new()) };
}

pub struct KernelStack(pub usize);

/// Return (bottom, top) of a kernel stack in kernel space.
pub fn kernel_stack_position(kstack_id: usize) -> (usize, usize) {
    let top = TRAMPOLINE - kstack_id * (KERNEL_STACK_SIZE + PAGE_SIZE);
    let bottom = top - KERNEL_STACK_SIZE;
    (bottom, top)
}

pub fn kstack_alloc() -> KernelStack {
    let kstack_id = KSTACK_ALLOCATOR.exclusive_access().alloc();
    let (kstack_bottom, kstack_top) = kernel_stack_position(kstack_id);
    KERNEL_SPACE.exclusive_access().insert_framed_area(
        kstack_bottom.into(),
        kstack_top.into(),
        MapPermission::R | MapPermission::W,
    );
    KernelStack(kstack_id)
}

impl Drop for KernelStack {
    fn drop(&mut self) {
        let (kernel_stack_bottom, _) = kernel_stack_position(self.0);
        let kernel_stack_bottom_va: VirtAddr = kernel_stack_bottom.into();
        KERNEL_SPACE
            .exclusive_access()
            .remove_area_with_start_vpn(kernel_stack_bottom_va.into());
    }
}
```

We will do the same for user stack:

```rust
// os/src/config.rs

pub const TRAMPOLINE: usize = usize::MAX - PAGE_SIZE + 1;
pub const TRAP_CONTEXT_BASE: usize = TRAMPOLINE - PAGE_SIZE;

// os/src/task/id.rs

fn trap_cx_bottom_from_tid(tid: usize) -> usize {
    TRAP_CONTEXT_BASE - tid * PAGE_SIZE
}

fn ustack_bottom_from_tid(ustack_base: usize, tid: usize) -> usize {
    ustack_base + tid * (PAGE_SIZE + USER_STACK_SIZE)
}
```

Then, `TaskUserRes` could be allocated with trap and user stack.

```rust
// impl TaskUserRes
pub fn alloc_user_res(&self) {
	let process = self.process.upgrade().unwrap();
	let mut process_inner = process.inner_exclusive_access();
	// alloc user stack
	let ustack_bottom = ustack_bottom_from_tid(self.ustack_base, self.tid);
	let ustack_top = ustack_bottom + USER_STACK_SIZE;
	process_inner.memory_set.insert_framed_area(
		ustack_bottom.into(),
		ustack_top.into(),
		MapPermission::R | MapPermission::W | MapPermission::U,
	);
	// alloc trap_cx
	let trap_cx_bottom = trap_cx_bottom_from_tid(self.tid);
	let trap_cx_top = trap_cx_bottom + PAGE_SIZE;
	process_inner.memory_set.insert_framed_area(
		trap_cx_bottom.into(),
		trap_cx_top.into(),
		MapPermission::R | MapPermission::W,
	);
}
```

Now, combine all things together:

```rust
// os/src/task/task.rs

pub struct TaskControlBlock {
    // immutable
    pub process: Weak<ProcessControlBlock>,
    pub kstack: KernelStack,
    // mutable
    inner: UPSafeCell<TaskControlBlockInner>,
}

pub struct TaskControlBlockInner {
    pub res: Option<TaskUserRes>,
    pub trap_cx_ppn: PhysPageNum,
    pub task_cx: TaskContext,
    pub task_status: TaskStatus,
    pub exit_code: Option<i32>,
}
```

---

### Design Data Operation

We still get one task in operation rather process, because it's the smallest instance unit. However, we need some interface to control process id.

```rust
pub fn add_task(task: Arc<TaskControlBlock>);
pub fn remove_task(task: Arc<TaskControlBlock>);
pub fn fetch_task() -> Option<Arc<TaskControlBlock>>;

pub fn pid2process(pid: usize) -> Option<Arc<ProcessControlBlock>>;
pub fn insert_into_pid2process(pid: usize, process: Arc<ProcessControlBlock>);
pub fn remove_from_pid2process(pid: usize);
```

Actually, many thing is same, for example:

```rust
// os/src/task/process.rs

impl ProcessControlBlock {
    pub fn new(elf_data: &[u8]) -> Arc<Self> {
		// ...
        let pid_handle = pid_alloc();
        let process = ...;
        let task = Arc::new(TaskControlBlock::new(
            Arc::clone(&process),
            ustack_base,
            true,
        ));
		// initiation of task...

        let mut process_inner = process.inner_exclusive_access();
        process_inner.tasks.push(Some(Arc::clone(&task)));
        drop(process_inner);
        insert_into_pid2process(process.getpid(), Arc::clone(&process));
        // add main thread to scheduler
        add_task(task);
        process
    }
}
```

If we `fork` a process, we only extract the first task which is itself, so no others will be copied.

```rust
pub fn fork(self: &Arc<Self>) -> Arc<Self> {
	let child = ...;
	parent.children.push(Arc::clone(&child));
	let task = Arc::new(TaskControlBlock::new(
		Arc::clone(&child),
		parent
			.get_task(0)
			.inner_exclusive_access()
			.res
			.as_ref()
			.unwrap()
			.ustack_base(),
		// here we do not allocate trap_cx or ustack again
		// but mention that we allocate a new kstack here
		false,
	));
	let mut child_inner = child.inner_exclusive_access();
	child_inner.tasks.push(Some(Arc::clone(&task)));
	drop(child_inner);
...
}
```

---

### Design System Operation

If we want to create a thread, as a naive designer, we only need the function entry addr, and arguments, yes! That's it!

```rust
// os/src/syscall/thread.rs

pub fn sys_thread_create(entry: usize, arg: usize) -> isize {
    let task = current_task().unwrap();
    let process = task.process.upgrade().unwrap();
    // create a new thread
    let new_task = Arc::new(TaskControlBlock::new(
        Arc::clone(&process),
        task.inner_exclusive_access().res.as_ref().unwrap().ustack_base,
        true,
    ));
    // add new task to scheduler
    add_task(Arc::clone(&new_task));
    let new_task_inner = new_task.inner_exclusive_access();
    let new_task_res = new_task_inner.res.as_ref().unwrap();
    let new_task_tid = new_task_res.tid;
    let mut process_inner = process.inner_exclusive_access();
    // add new thread to current process
    let tasks = &mut process_inner.tasks;
    while tasks.len() < new_task_tid + 1 {
        tasks.push(None);
    }
    tasks[new_task_tid] = Some(Arc::clone(&new_task));
    let new_task_trap_cx = new_task_inner.get_trap_cx();
    *new_task_trap_cx = TrapContext::app_init_context(
        entry,
        new_task_res.ustack_top(),
        kernel_token(),
        new_task.kstack.get_top(),
        trap_handler as usize,
    );
    (*new_task_trap_cx).x[10] = arg;
    new_task_tid as isize
}
```

Now, `sys_exit` will receive a `exit_code` and recycle its resource. Notice, if `tid == 0`, the thread of process itself will make other sub threads moved to `init` process.

```rust
// pub fn exit_current_and_run_next(exit_code: i32) {
// ...
{
	let mut initproc_inner = INITPROC.inner_exclusive_access();
	for child in process_inner.children.iter() {
		child.inner_exclusive_access().parent = Some(Arc::downgrade(&INITPROC));
		initproc_inner.children.push(child.clone());
	}
}

let mut recycle_res = Vec::<TaskUserRes>::new();
for task in process_inner.tasks.iter().filter(|t| t.is_some()) {
	let task = task.as_ref().unwrap();
	remove_inactive_task(Arc::clone(&task));
	let mut task_inner = task.inner_exclusive_access();
	if let Some(res) = task_inner.res.take() {
		recycle_res.push(res);
	}
}
```

`sys_waittid` will check thread state and recycle if could, return `-2` if it has not exited. Why need it? Because `sys_exit` can't recycle itself unless the thread of process, other thread can call `waittid` to remove it from tasks queue, then it will be cleared by rust!

```rust
// os/src/syscall/thread.rs

/// thread does not exist, return -1
/// thread has not exited yet, return -2
/// otherwise, return thread's exit code
pub fn sys_waittid(tid: usize) -> i32 {
    let task = current_task().unwrap();
    let process = task.process.upgrade().unwrap();
    let task_inner = task.inner_exclusive_access();
    let mut process_inner = process.inner_exclusive_access();
    // a thread cannot wait for itself
    if task_inner.res.as_ref().unwrap().tid == tid {
        return -1;
    }
    let mut exit_code: Option<i32> = None;
    let waited_task = process_inner.tasks[tid].as_ref();
    if let Some(waited_task) = waited_task {
        if let Some(waited_exit_code) = waited_task.inner_exclusive_access().exit_code {
            exit_code = Some(waited_exit_code);
        }
    } else {
        // waited thread does not exist
        return -1;
    }
    if let Some(exit_code) = exit_code {
        // dealloc the exited thread
        process_inner.tasks[tid] = None;
        exit_code
    } else {
        // waited thread has not exited
        -2
    }
}
```

