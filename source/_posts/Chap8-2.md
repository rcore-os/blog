---
title: rcore-handnote-8-2
date: 2025-04-27 9:40:28
categories: 
    - handnote 
tags:
    - 2025春夏季开源操作系统训练营
---
## Chapter 8-2

### Introduction

We will develop exclusion mechanism previously mentioned.

Beside construction, we need to abstract possible situation of data sharing. A usual native thought is a thread want to modify one thing but due to thread switch, the data is already modified and we get wrong result. So based on this, we want a operation to be **Atomic**, which means the operation excluding others. Now we can alleviate this restriction and generalize this.

### 

Generalization:
- Allow multiple but finite thread can join one atomic operation.
- Allow condition of atomic operation.

Before such generalization, we want a way to represent atomic operation. We call the content of this operation **Critical Section**, and multiple threads operations in indeterminate time sequence **Race Condition**. So the basic problem of data sharing push us to identify multiple different operations by different threads, we can't restrict data because the problem is on modification by threads, we need to **Lock** operations!

So, it there's a lock sharing by threads, each threads can declare **Lock it!**, and no other threads can access this thread again.

Now, back to our generalization. If this lock has a bound of access number, many can access until reaching a bound. That's also a reasonable design, we call this **Semaphore**; If this lock has a signal which one thread can send it to others to allow others to access it, That's also a reasonable design, we call this **Condition Variable**.

If the real minimal sharing thing is **Lock** rather than data, we can discard so called data problem, and focus on lock itself, each threads can do anything in this lock and excluding others.

### Design

No matter which kinds of lock, this is shared among threads.

```rust
pub struct ProcessControlBlock {
    // immutable
    pub pid: PidHandle,
    // mutable
    inner: UPSafeCell<ProcessControlBlockInner>,
}
pub struct ProcessControlBlockInner {
    ...
    pub lock_list: Vec<Option<Arc<Lock>>>,
}

pub struct Lock {
    pub inner: UPSafeCell<LockInner>,
}
pub struct LockInner {
	pub data: ...
    pub wait_queue: VecDeque<Arc<TaskControlBlock>>,
}
```

In such design, one lock can push one thread to  `wait_queue` to stop it, and pop front to start it. `data` is a generalization for various locks.

Then, in one process, it owns many locks used in various conditions, one can easily take it as a generalization of many data(actually nothing related to real data) we want to share.

### Basic Lock

Now, we want to construct a basic lock allowing simple `lock`, `unlock` operation.

```rust
pub trait Mutex: Sync + Send {
    fn lock(&self);
    fn unlock(&self);
}
```

Usually, there's U-level, M-level, S-level implementation. First, we gonna try first one easily, knowing the heuristic design of M-level, and extend basic thought to S-level.

---

#### U-level

A naive approach is to declare a global boolean indicating block state. `lock` will wait if the boolean is true and try to set it to true, and `unlock` will set it to false to release.

```rust
static mut mutex :i32 = 0;

fn lock(mutex: i32) {
    while (mutex);
    mutex = 1;
}

fn unlock(mutex: i32){
    mutex = 0;
}
```

However, that's wrong! We can't construct lock by things we want to lock! Threads can jump in any instructions and break it! That's means we can't do it in U-level? We should ponder further in real situation, imagine two threads modify one thing in nearly same time, if we could set two global state in a operation that excluding each other(for example, one state set to 1 and another state set to 0), then only one operation can really be implemented and we can check this condition, allow it to get the lock.

```rust
static mut flag : [i32;2] = [0,0]; // 哪个线程想拿到锁？
static mut turn : i32 = 0;         // 排号：轮到哪个线程? (线程 0 or 1?)

fn lock() {
    flag[self] = 1;             // 设置自己想取锁 self: 线程 ID
    turn = 1 - self;            // 设置另外一个线程先排号
    while ((flag[1-self] == 1) && (turn == 1 - self)); // 忙等
}

fn unlock() {
    flag[self] = 0;             // 设置自己放弃锁
}
```

Now analyze the code, we find that no matter which flag is 1, or both 1, indicating certain thread want to get lock, `turn` will be a excluding state to `flag`, which means if another thread modify `turn` in same time, the turn can only be in one of the state and only one thread can get the lock.

---

#### M-level

Is there any predefined operation in instructions that is atomic? Then we can use it as a lock. The answer is **Yes**, in RISC-V, it's:

- AMO: Atomic memory operation
- LR/SC: Load Reserved/Store Conditional

**AMO**: will read the value in memory and write new value, then store the old value to target register(s.t. `amoadd.w rd, rs2, (rs1)`). 

**LR/SC**: **LR** will read memory and store in target register, and leave the addr of this memory, then **SC** could check the addr and write data to this addr, output a condition(0/1) to target register.(s.t. `lr.w rd, (rs1)`, `sc.w rd, rs2, (rs1)`)

We can use it to implement a atomic function:
```
# RISC-V sequence for implementing a TAS  at (s1)
li t2, 1                 # t2 <-- 1
Try: lr  t1, s1          # t1 <-- mem[s1]  (load reserved)
        bne t1, x0, Try     # if t1 != 0, goto Try:
        sc  t0, s1, t2      # mem[s1] <-- t2  (store conditional)
        bne t0, x0, Try     # if t0 !=0 ('sc' Instr failed), goto Try:
Locked:
        ...                 # critical section
Unlock:
        sw x0,0(s1)         # mem[s1] <-- 0
```

Here the logic of `Try` is `mem[s1]` would be zero if it's unlocked, and would be non-zero if it's locked. So, `Try` will compare `t1` and `x0`, actually `mem[s1]` and `0`, if equal to zero, then try to store `t2` into `s1`, if succeed, it will compare it again for the output signal `t0` and `x0`, actually the output signal and `0`, if succeed, it will jump out otherwise repeat.In this process, if the write operation failed, `t0` would be non-zero, and repeat in `Try`.

If we want to `Unlock`, we write `x0` to `s1` to set `mem[s1]` to zero. Which is the unlocked state.

#### S-level

Then we could take the function to rust and package it. A simple refactor is when we in repetition loop, we `yield`, and give CPU to others.

---

Now, for any kinds of locks, we could apply it to our structure.

First, when we create a lock, we create and push it to list or set in empty element.

```rust
// os/src/syscall/sync.rs
pub fn sys_mutex_create(blocking: bool) -> isize {
    let process = current_process();
    let mutex: Option<Arc<dyn Mutex>> = if !blocking {
        Some(Arc::new(MutexSpin::new()))
    } else {
        Some(Arc::new(MutexBlocking::new()))
    };
    let mut process_inner = process.inner_exclusive_access();
    if let Some(id) = process_inner
        .mutex_list
        .iter()
        .enumerate()
        .find(|(_, item)| item.is_none())
        .map(|(id, _)| id)
    {
        process_inner.mutex_list[id] = mutex;
        id as isize
    } else {
        process_inner.mutex_list.push(mutex);
        process_inner.mutex_list.len() as isize - 1
    }
}
```

When we call `lock`, we should provide corresponding id of the lock, if it's already locked, we push to `wait_queue`, else we lock it and goes on.

```rust
// os/src/syscall/sync.rs
pub fn sys_mutex_lock(mutex_id: usize) -> isize {
    let process = current_process();
    let process_inner = process.inner_exclusive_access();
    let mutex = Arc::clone(process_inner.mutex_list[mutex_id].as_ref().unwrap());
    drop(process_inner);
    drop(process);
    mutex.lock();
    0
}
// os/src/sync/mutex.rs
impl Lock for MutexBlocking {
    fn lock(&self) {
        let mut mutex_inner = self.inner.exclusive_access();
        if ... {
            mutex_inner.wait_queue.push_back(current_task().unwrap());
			// ... other operations
            drop(mutex_inner);
            block_current_and_run_next();
        } else {
			// ... other operations
        }
    }
}
```

Same reverse operation:

```rust
// os/src/syscall/sync.rs
pub fn sys_mutex_unlock(mutex_id: usize) -> isize {
    let process = current_process();
    let process_inner = process.inner_exclusive_access();
    let mutex = Arc::clone(process_inner.mutex_list[mutex_id].as_ref().unwrap());
    drop(process_inner);
    drop(process);
    mutex.unlock();
    0
}
// os/src/sync/mutex.rs
impl Mutex for MutexBlocking {
    fn unlock(&self) {
        let mut mutex_inner = self.inner.exclusive_access();
		// ... other operation
		if ... {
			if let Some(waking_task) = mutex_inner.wait_queue.pop_front() {
				add_task(waking_task);
			}
		}
    }
}
```

---

### Semaphore

It's simple, we only need to switch boolean to number and check the bound. So, the initiated count is the bound, if one thread access, it will minus one, and release, add one. We only need to check positive or negative.

Apply our structure:

```rust
    pub fn up(&self) {
        let mut inner = self.inner.exclusive_access();
        inner.count += 1;
        if inner.count <= 0 {
            if let Some(task) = inner.wait_queue.pop_front() {
                add_task(task);
            }
        }
    }

    pub fn down(&self) {
        let mut inner = self.inner.exclusive_access();
        inner.count -= 1;
        if inner.count < 0 {
            inner.wait_queue.push_back(current_task().unwrap());
            drop(inner);
            block_current_and_run_next();
        }
    }
```

If the initiated count equal to `1`, we back to `mutex`!, which indicates sole thread access!

Actually, we could use it for **synchronization** operation, we set count to `0`, if one thread access, it will be blocked, and another thread will could release and add one to count, then the original thread finally could access. Then the second thread will always be advanced to first one.

Here, the first is always advanced to second.
```rust
const SEM_SYNC: usize = 0; //信号量ID
unsafe fn first() -> ! {
    sleep(10);
    println!("First work and wakeup Second");
    semaphore_up(SEM_SYNC); //信号量V操作
    exit(0)
}
unsafe fn second() -> ! {
    println!("Second want to continue,but need to wait first");
    semaphore_down(SEM_SYNC); //信号量P操作
    println!("Second can work now");
    exit(0)
}
```

### Conditional Variable

If we want one thread owns the ability of release lock for others, we need the `CondVar`. We have to dispatch operation in `wait_queue`, if one thread `signal` others, it will pop out a thread, which means trigger it **You are free!**. And if one thread `wait`, it will push itself to queue to **wait**, The unlock and lock is important because in wait operation, it allow other thread to modify **condition**, but it should be after of the push operation, in case that the signal is before the push, then we can never receive the signal again! We won't encapsulate condition check to `CondVar` because it should leave to user to design it, we only leave out interface for user.

```rust
pub fn signal(&self) {
	let mut inner = self.inner.exclusive_access();
	if let Some(task) = inner.wait_queue.pop_front() {
		add_task(task);
	}
}
pub fn wait(&self, mutex: Arc<dyn Mutex>) {
    let mut inner = self.inner.exclusive_access();
    inner.wait_queue.push_back(current_task().unwrap());
    drop(inner);
    mutex.unlock();                 
    block_current_and_run_next();
    mutex.lock();
}
```

However, if condition check is leave out to user, we can't ensure the condition be violated due to data sharing, so usually we need to append `mutex` lock for this section.

```rust
static mut A: usize = 0;   //全局变量

const CONDVAR_ID: usize = 0;
const MUTEX_ID: usize = 0;

unsafe fn first() -> ! {
    sleep(10);
    println!("First work, Change A --> 1 and wakeup Second");
    mutex_lock(MUTEX_ID);
    A=1;
    condvar_signal(CONDVAR_ID);
    mutex_unlock(MUTEX_ID);
    ...
}
unsafe fn second() -> ! {
    println!("Second want to continue,but need to wait A=1");
    mutex_lock(MUTEX_ID);
    while A==0 {
        condvar_wait(CONDVAR_ID, MUTEX_ID);
    }
    mutex_unlock(MUTEX_ID);
    ...
}
```

We can see that if `A=1`, second won't `wait` repeatly, and goes out.