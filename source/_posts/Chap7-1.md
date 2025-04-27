---
title: rcore-handnote-7-1
date: 2025-04-27 9:40:28
categories: 
    - handnote 
tags:
    - 2025春夏季开源操作系统训练营
---
## Chapter 7-1

### Introduction

We gonna abstract `Stdin` and `Stdout` by file, and insert into file descriptor. Therefore support **Pipe** operation and **IO Redirection** across each process.


### Everything Is a File

The design philosophy of **Everything is a file** will generalize everything to file based on IO operations while omit concrete content semantics.

Abstraction of IO hardware:
- read-only: s.t. keyboard
- write-only: s.t. screen
- read-write: s.t. serial device

Abstraction of IO operations(based on file descriptor):
- open: open file while possessing it by certain process.
- close: close file while discarding it by certain process.
- read: read file into memory.
- write: write file from memory.

When a process is created, it owns three file as operation abstraction:
- 0: Stdin
- 1: Stdout
- 2: Stderr(which we will merge with Stdout)

```rust
impl TaskControlBlock {
    pub fn new(elf_data: &[u8]) -> Self {
        ...
        let task_control_block = Self {
            pid: pid_handle,
            kernel_stack,
            inner: Mutex::new(TaskControlBlockInner {
				// ...
                fd_table: vec![
                    // 0 -> stdin
                    Some(Arc::new(Stdin)),
                    // 1 -> stdout
                    Some(Arc::new(Stdout)),
                    // 2 -> stderr
                    Some(Arc::new(Stdout)),
                ],
            }),
        };
        ...
    }
}
```

### Pipe

In usual shell, `|` is the symbolic of pipe. Manage input from left and output to right. If we abstract everything to file, s.t. `Stdin` or `Stdout`, so does **Pipe**, it has `read` and `write` ends, user could read thing from this end and write thing(often in child process) to other end, transfer those underneath thing.

We already has file descriptor as the indication of file, we will implement same operation for pipe.

`sys_pipe` get the ptr of a array with `len = 2`, output the write and the read ends of descriptors of pipe in the ptr.

```rust
// user/src/syscall.rs

const SYSCALL_PIPE: usize = 59;

pub fn sys_pipe(pipe: &mut [usize]) -> isize {
    syscall(SYSCALL_PIPE, [pipe.as_mut_ptr() as usize, 0, 0])
}
```

---

So What's the basic design of pipe?

It should has write and read ends which means ends share the same data, and record read and write informations on this data. We will construct `RingBuffer` to achieve this. `Pipe` owns a buffer control read and write, buffer will record data from head to tail index. Why we can't just use two piece of data or `Queue`?

Because there's no copy and suitable for our restriction! We will read data from head and move forward and push data to end in a fixed array rather allocation for `Queue`.

```rust
// os/src/fs/pipe.rs

pub struct Pipe {
    readable: bool,
    writable: bool,
    buffer: Arc<Mutex<PipeRingBuffer>>,
}

const RING_BUFFER_SIZE: usize = 32;

#[derive(Copy, Clone, PartialEq)]
enum RingBufferStatus {
    FULL,
    EMPTY,
    NORMAL,
}

pub struct PipeRingBuffer {
    arr: [u8; RING_BUFFER_SIZE],
    head: usize, // head index of ring buffer
    tail: usize, // tail index of ring buffer
    status: RingBufferStatus,
    write_end: Option<Weak<Pipe>>,
}

impl PipeRingBuffer {
    pub fn set_write_end(&mut self, write_end: &Arc<Pipe>) {
        self.write_end = Some(Arc::downgrade(write_end));
    }
}

/// Return (read_end, write_end)
pub fn make_pipe() -> (Arc<Pipe>, Arc<Pipe>) {
    let buffer = Arc::new(Mutex::new(PipeRingBuffer::new()));
    let read_end = Arc::new(
        Pipe::read_end_with_buffer(buffer.clone())
    );
    let write_end = Arc::new(
        Pipe::write_end_with_buffer(buffer.clone())
    );
    buffer.lock().set_write_end(&write_end);
    (read_end, write_end)
}

impl PipeRingBuffer {
    pub fn read_byte(&mut self) -> u8 {
        self.status = RingBufferStatus::NORMAL;
        let c = self.arr[self.head];
		// move forward
        self.head = (self.head + 1) % RING_BUFFER_SIZE;
        if self.head == self.tail {
            self.status = RingBufferStatus::EMPTY;
        }
        c
    }
    pub fn available_read(&self) -> usize {
        if self.status == RingBufferStatus::EMPTY {
            0
        } else {
			// data from head to tail!
            if self.tail > self.head {
                self.tail - self.head
            } else {
                self.tail + RING_BUFFER_SIZE - self.head
            }
        }
    }
    pub fn all_write_ends_closed(&self) -> bool {
        self.write_end.as_ref().unwrap().upgrade().is_none()
    }
}
```

In one process, there's a possible that can't read all thing in once, if so, we will pause and run other thing until the write end is finished.

```rust
// os/src/fs/pipe.rs

impl File for Pipe {
    fn read(&self, buf: UserBuffer) -> usize {
        assert!(self.readable());
        let want_to_read = buf.len();
        let mut buf_iter = buf.into_iter();
        let mut already_read = 0usize;
        loop {
            let mut ring_buffer = self.buffer.exclusive_access();
            let loop_read = ring_buffer.available_read();
            if loop_read == 0 {
                if ring_buffer.all_write_ends_closed() {
                    return already_read;
                }
                drop(ring_buffer);
                suspend_current_and_run_next();
                continue;
            }
            for _ in 0..loop_read {
                if let Some(byte_ref) = buf_iter.next() {
                    unsafe {
                        *byte_ref = ring_buffer.read_byte();
                    }
                    already_read += 1;
                    if already_read == want_to_read {
                        return want_to_read;
                    }
                } else {
                    return already_read;
                }
            }
        }
    }
}
```

### Arguments

We will combine our pipe with our shell.

First, parse our arguments and push `0` to end to indicated end.

```rust
// user/src/bin/user_shell.rs

let args: Vec<_> = line.as_str().split(' ').collect();
let mut args_addr: Vec<*const u8> = args
	.iter()
	.map(|&arg| {
		let s = arg.to_string();
		s.push('\0');
		s.as_ptr()
	})
	.collect();
args_addr.push(0 as *const u8)
```

Now task will accept a series of args rather than solely one string. So make `sys_exec` to:

```rust
// os/src/syscall/process.rs

pub fn sys_exec(path: *const u8, mut args: *const usize) -> isize {
    let token = current_user_token();
    let path = translated_str(token, path);
    let mut args_vec: Vec<String> = Vec::new();
	// args would be a ptr of array contains ptr of string.
    loop {
        let arg_str_ptr = *translated_ref(token, args);
        if arg_str_ptr == 0 {
            break;
        }
        args_vec.push(translated_str(token, arg_str_ptr as *const u8));
        unsafe { args = args.add(1); }
    }
    if let Some(app_inode) = open_file(path.as_str(), OpenFlags::RDONLY) {
        let all_data = app_inode.read_all();
        let task = current_task().unwrap();
        let argc = args_vec.len();
        task.exec(all_data.as_slice(), args_vec);
        // return argc because cx.x[10] will be covered with it later
        argc as isize
    } else {
        -1
    }
}
```

Now, we really gonna use user stack to store these args!

```rust
// os/src/task/task.rs

impl TaskControlBlock {
	// notice exec will allocate a new memory set!
    pub fn exec(&self, elf_data: &[u8], args: Vec<String>) {
		// ...
		// first allocate memory for ptr of strings.
        user_sp -= (args.len() + 1) * core::mem::size_of::<usize>();
        let argv_base = user_sp;
		// allocate new memory in user stack addr as a vector of strings 
        let mut argv: Vec<_> = (0..=args.len())
            .map(|arg| {
                translated_refmut(
                    memory_set.token(),
                    (argv_base + arg * core::mem::size_of::<usize>()) as *mut usize
                )
            })
            .collect();
        *argv[args.len()] = 0;
        for i in 0..args.len() {
			// allocate for strings themselves.
            user_sp -= args[i].len() + 1;
            *argv[i] = user_sp;
            let mut p = user_sp;
            for c in args[i].as_bytes() {
                *translated_refmut(memory_set.token(), p as *mut u8) = *c;
                p += 1;
            }
            *translated_refmut(memory_set.token(), p as *mut u8) = 0;
        }
        // make the user_sp aligned to 8B for k210 platform
        user_sp -= user_sp % core::mem::size_of::<usize>();

        // **** hold current PCB lock
        let mut inner = self.acquire_inner_lock();
        // substitute memory_set
        inner.memory_set = memory_set;
        // update trap_cx ppn
        inner.trap_cx_ppn = trap_cx_ppn;
        // initialize trap_cx
        let mut trap_cx = TrapContext::app_init_context(
            entry_point,
            user_sp,
            KERNEL_SPACE.lock().token(),
            self.kernel_stack.get_top(),
            trap_handler as usize,
        );
		// a[0] be args len
        trap_cx.x[10] = args.len();
		// a[1] be args base addr
        trap_cx.x[11] = argv_base;
        *inner.get_trap_cx() = trap_cx;
        // **** release current PCB lock
    }
}
```

Now we provide receive operation in `_start`, in which `main` could use it at first time S-level reading data and passing to U-level:

```rust
// user/src/lib.rs

#[no_mangle]
#[link_section = ".text.entry"]
pub extern "C" fn _start(argc: usize, argv: usize) -> ! {
    unsafe {
        HEAP.lock()
            .init(HEAP_SPACE.as_ptr() as usize, USER_HEAP_SIZE);
    }
    let mut v: Vec<&'static str> = Vec::new();
    for i in 0..argc {
        let str_start = unsafe {
            ((argv + i * core::mem::size_of::<usize>()) as *const usize).read_volatile()
        };
        let len = (0usize..).find(|i| unsafe {
            ((str_start + *i) as *const u8).read_volatile() == 0
        }).unwrap();
        v.push(
            core::str::from_utf8(unsafe {
                core::slice::from_raw_parts(str_start as *const u8, len)
            }).unwrap()
        );
    }
    exit(main(argc, v.as_slice()));
}
```

### Redirection

Redirection usually represent using `>` and `<` for output and input.

If we really want to redirect IO, we will combine `user_shell` and `sys_dup`.

First, `sys_dup` will duplicate a new file descriptor already opened in this process.

Then we parse user arguments, if there exist `>` or `<`, fork a new child process, open the file and close our corresponding `Stdin` and `Stdout` descriptor, using `dup` to hold the place of it by `file` itself! Then `exec` by original parsed arguments, and receive results in parent process.

