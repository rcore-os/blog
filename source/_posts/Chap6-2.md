---
title: rcore-handnote-6-2
date: 2025-04-27 9:40:28
categories: 
    - handnote 
tags:
    - 2025春夏季开源操作系统训练营
---
## Chapter 6-2

### Introduction

We gonna load our `easy-fs` to kernel. First, we need to know our device interface. Second, our **Inode** should be wrapped in OS as **OSInode** for extended functionality. Then we implement `sys_read/write` for it.

### MMIO-Memory-Mapped I/O

The device registers of peripherals can be accessed through specific physical memory addresses, **VirtIO** MMIO physical address range for the peripheral bus is 4KiB starting at 0X10001000. 

```rust
// os/src/config.rs

#[cfg(feature = "board_qemu")]
pub const MMIO: &[(usize, usize)] = &[
    (0x10001000, 0x1000),
];
```

### OS Inode

We only take restriction on our operations with `readable` and `writable` by `OpenFlags`. `offset` and `Arc` is a way to tackle simple situation of multi processes.

```rust
// os/src/fs/inode.rs

bitflags! {
    pub struct OpenFlags: u32 {
        const RDONLY = 0;
        const WRONLY = 1 << 0;
        const RDWR = 1 << 1;
        const CREATE = 1 << 9;
        const TRUNC = 1 << 10;
    }
}

impl OpenFlags {
    /// Do not check validity for simplicity
    /// Return (readable, writable)
    pub fn read_write(&self) -> (bool, bool) {
        if self.is_empty() {
            (true, false)
        } else if self.contains(Self::WRONLY) {
            (false, true)
        } else {
            (true, true)
        }
    }
}

pub struct OSInode {
    readable: bool,
    writable: bool,
    inner: Mutex<OSInodeInner>,
}

pub struct OSInodeInner {
    offset: usize,
    inode: Arc<Inode>,
}

impl OSInode {
    pub fn new(
        readable: bool,
        writable: bool,
        inode: Arc<Inode>,
    ) -> Self {
        Self {
            readable,
            writable,
            inner: Mutex::new(OSInodeInner {
                offset: 0,
                inode,
            }),
        }
    }
}
```

#### File Descriptor Table

Now we need to connect file operations with process, each process need a descriptors table(which manage many files!) to indicate file record infos. 

```rust
// os/src/task/task.rs

pub struct TaskControlBlockInner {
	// ...
    pub fd_table: Vec<Option<Arc<dyn File + Send + Sync>>>,
}
```

Remember our previous root inode? We load it directly for easy manipulation. So our workflow would be for current process, push a descriptor of allocation, and return the ptr of this allocation.

```rust
// os/src/fs/inode.rs

lazy_static! {
    pub static ref ROOT_INODE: Arc<Inode> = {
        let efs = EasyFileSystem::open(BLOCK_DEVICE.clone());
        Arc::new(EasyFileSystem::root_inode(&efs))
    };
}

pub fn open_file(name: &str, flags: OpenFlags) -> Option<Arc<OSInode>> {
    let (readable, writable) = flags.read_write();
    if flags.contains(OpenFlags::CREATE) {
        if let Some(inode) = ROOT_INODE.find(name) {
            // clear size
            inode.clear();
            Some(Arc::new(OSInode::new(
                readable,
                writable,
                inode,
            )))
        } else {
            // create file
            ROOT_INODE.create(name)
                .map(|inode| {
                    Arc::new(OSInode::new(
                        readable,
                        writable,
                        inode,
                    ))
                })
        }
    } else {
        ROOT_INODE.find(name)
            .map(|inode| {
                if flags.contains(OpenFlags::TRUNC) {
                    inode.clear();
                }
                Arc::new(OSInode::new(
                    readable,
                    writable,
                    inode
                ))
            })
    }
}
```

```rust
// os/src/syscall/fs.rs

pub fn sys_open(path: *const u8, flags: u32) -> isize {
    let task = current_task().unwrap();
    let token = current_user_token();
    let path = translated_str(token, path);
    if let Some(inode) = open_file(
        path.as_str(),
        OpenFlags::from_bits(flags).unwrap()
    ) {
        let mut inner = task.acquire_inner_lock();
        let fd = inner.alloc_fd();
        inner.fd_table[fd] = Some(inode);
        fd as isize
    } else {
        -1
    }
}

// os/src/syscall/fs.rs

pub fn sys_close(fd: usize) -> isize {
    let task = current_task().unwrap();
    let mut inner = task.inner_exclusive_access();
    if fd >= inner.fd_table.len() {
        return -1;
    }
    if inner.fd_table[fd].is_none() {
        return -1;
    }
    inner.fd_table[fd].take();
    0
}
```

The implementation is same for `sys_read/write`.