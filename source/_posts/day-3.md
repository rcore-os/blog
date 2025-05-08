---
title: arceos-handnote-3
date: 2025-04-27 9:40:28
categories: 
    - handnote 
tags:
    - 2025春夏季开源操作系统训练营
---
## Day-3

## Device

In common, devices can be separated to **FS**, **Net**, **Dispaly**.

```rust
/// A structure that contains all device drivers, organized by their category.
#[derive(Default)]
pub struct AllDevices {
    /// All network device drivers.
    #[cfg(feature = "net")]
    pub net: AxDeviceContainer<AxNetDevice>,
    /// All block device drivers.
    #[cfg(feature = "block")]
    pub block: AxDeviceContainer<AxBlockDevice>,
    /// All graphics device drivers.
    #[cfg(feature = "display")]
    pub display: AxDeviceContainer<AxDisplayDevice>,
}
```

Devices will be initiated in `axruntime`, where `axdriver` module will be loaded to seek each device and mount drivers.

In qemu, `virtio-mmio` will send request to probe driver response otherwise return 0 as non-driver.

### Block Driver

Block driver provide interface to write and read block providing IO operations and perennial storage.

Aceros use module `axfs`, with definition of interface `vfs`, and concrete implementation of `ramfs` and `devfs`.

## Monolith

In U-Level, we will separate kernel memory and user memory, allowing user context used for process.

The basic logic would be construct new user space,load file to it and initiate user stack, then spawn user task with app_entry.

The top of page root would be shared as kernel space, and below would be independent as user space.

In user space separation, many kinds of resources can't be shared as global resources, rather the demand of `TaskExt` as a reference to those independent resources owned by each user apps.

In `TaskInner`, we store the ptr of `TaskExt` by macro declaration of such type.

```rust
struct AxTask {
    ...
    task_ext_ptr: *mut u8
}
```

```rust
/// Task extended data for the monolithic kernel.
pub struct TaskExt {
    /// The process ID.
    pub proc_id: usize,
    /// The user space context.
    pub uctx: UspaceContext,
    /// The virtual memory address space.
    pub aspace: Arc<Mutex<AddrSpace>>,
}

// It will expanded as a trait implmentation of reference to ptr as the `TaskExt` type.
def_task_ext!(TaskExt)

pub fn spawn_user_task(aspace: Arc<Mutex<AddrSpace>>, uctx: UspaceContext) -> AxTaskRef {
    let mut task = TaskInner::new(
        || {
            let curr = axtask::current();
            let kstack_top = curr.kernel_stack_top().unwrap();
            ax_println!(
                "Enter user space: entry={:#x}, ustack={:#x}, kstack={:#x}",
                curr.task_ext().uctx.get_ip(),
                curr.task_ext().uctx.get_sp(),
                kstack_top,
            );
            unsafe { curr.task_ext().uctx.enter_uspace(kstack_top) };
        },
        "userboot".into(),
        crate::KERNEL_STACK_SIZE,
    );
    task.ctx_mut()
        .set_page_table_root(aspace.lock().page_table_root());
    task.init_task_ext(TaskExt::new(uctx, aspace));
    axtask::spawn_task(task)
}
```

### NameSpace

To reuse resources, we will construct a `axns_resource` section in compilation to form a global namespace. Each will be shared by `Arc::new()`.

If there's a demand of uniqueness, we will allocate space and copy them.

### Page Fault

We could implement lazy allocation of user space memory. We register `PAGE_FAULT` for our function and call `handle_page_fault` for `AddrSpace`.

```rust
impl AddrSpace
pub fn handle_page_fault(...) -> ...
        if let Some(area) = self.areas.find(vaddr) {
            let orig_flags = area.flags();
            if orig_flags.contains(access_flags) {
                return area
                    .backend()
                    .handle_page_fault(vaddr, orig_flags, &mut self.pt);
            }
        }
```

`MemoryArea` has two way:
- Linear: direct construct map relation of memory based on physical contiguous mmemory.
- Alloc: only construct null-map, and call `handle_page_fault` to really allocate memory.

### User App

**ELF** is the default format of many apps. Kernel take the responsibility to load app to correct region.

Notice the offset of file and virtual space may be different due to optimization of **ELF**.

In order to load apps from linux, we will construct a **Posix Api** given interface mimic to linux.

