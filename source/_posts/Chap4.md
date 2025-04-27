---
title: rcore-handnote-4
date: 2025-04-27 9:40:28
categories: 
    - handnote 
tags:
    - 2025春夏季开源操作系统训练营
---
## Chapter 4

### Introduction

We don't want a fixed physical addr for allocation, rather, we want a unified abstract interface for dynamic memory layout for app storage. We call it **Virtual Address**

Safety: Every app will be allocated in its own virtual memory space, so each can't interfere others.

Efficiency: Every app can coexist in same time without demand of reading outer peripherals to switch app.(With development of memory size)

We need **MMU**(Memory Management Unit) to achieve **Address Translation** for interview from virtual to physical.

Different designs occur.

---

### Design

### Segment Design

![alt text](/rCore-Blog/assets/Lab4-1.png)

Each app exist in one fixed slot for one segment as $[0,bound)$, with a linear map by **MMU**.

Problem: Wasteful and inflexible

We may want a different linear map for each app， for example, its allocation for heap, data, code etc... So we can dispatch memory in more finer style, but it can't resolve the problem because now even slot is dynamically allocated, it may still exist some free memory too small to reuse, cause the **External Fragment** rather than **Internal Fragment** which is the problem due to fixed slot.

### Paging Design

![alt text](/rCore-Blog/assets/Lab4-2.png)
We could set a **Protection bit** as `r` for read, `w` for write, `x` for execution.

Another way is to inverse our mind, rather take a slot on memory, we take slot on **MMU**, it can map its slot(now we call it **Page**) for real physical memory layout. To adjust, we can take slice for **Page** to form **Frame** which is a smaller unit to suit physical memory layout, each app can take many **Page Number** for a **Page Table**, record the map.


## Page Design

![alt text](/rCore-Blog/assets/Lab4-3.png)

**SV39** only use lower 39 bits rather whole 64 bits in design even bit width is 64 bits(it's a fairly large amount!)

In a address, $[11:0]$ called **Page Offset**, and $[38:12]$ is the **VPN** which will be used for location of page and use offset to direct in one page(with 4KiB in one page).

We should modify `satp` to open Paging for S and U-level memory.

```rust
const PAGE_SIZE: usize = 4096
const PAGE_SIZE_BIT: usize = 12
```

Page Size and offset to slice physical addr.

```rust
// os/src/mm/address.rs

impl PhysAddr {
    pub fn floor(&self) -> PhysPageNum { PhysPageNum(self.0 / PAGE_SIZE) }
    pub fn ceil(&self) -> PhysPageNum { PhysPageNum((self.0 + PAGE_SIZE - 1) / PAGE_SIZE) }
}
```

Page Entry to bundle permission and physical page.

![](/rCore-Blog/assets/Lab4-4.png)

```rust
pub fn ppn(&self) -> PhysPageNum {
	(self.bits >> 10 & ((1usize << 44) - 1)).into()
}
pub fn flags(&self) -> PTEFlags {
	PTEFlags::from_bits(self.bits as u8).unwrap()
}
```

Usually, a simple design for page manager would be a linear map from base addr and follow up. But actually it will take a huge amount of memory due to the storage of offset by base addr for each app.

A finer design is from **Trie**. We will take index slice for each 8 bits(it will fit in to 4KB just right!), it means for each slice has 512 states, and link those state up, form a tree. Usually with 3-level for **Page Index**. Total 27 bits.

Virtual Page will reserve 27 bits for the index slice and 12 bits for offset for certain page. Total 39 bits.

When we transform a virtual addr to physical one, we will do the following exposition reversely.

## Page Management Design

A simple allocation for page(rather management!) is stack style.

```rust
pub struct StackFrameAllocator {
    current: usize,  //空闲内存的起始物理页号
    end: usize,      //空闲内存的结束物理页号
    recycled: Vec<usize>,
}
```

Based on Allocation, we can design **Page Table**.

```rust
// os/src/mm/frame_allocator.rs

pub struct FrameTracker {
    pub ppn: PhysPageNum,
}

impl FrameTracker {
    pub fn new(ppn: PhysPageNum) -> Self {
        // page cleaning
        let bytes_array = ppn.get_bytes_array();
        for i in bytes_array {
            *i = 0;
        }
        Self { ppn }
    }
}

// os/src/mm/page_table.rs

pub struct PageTable {
    root_ppn: PhysPageNum,
    frames: Vec<FrameTracker>,
}
```

It means for one physical page, we will record each allocation by vector of FrameTracker as a representation of real **Frame** after the root.

We should design transformation from virtual addr to physical addr.

```rust
// for each idxs represent index slices of virtual addr.
for i in 0..3 {
	let pte = &mut ppn.get_pte_array()[idxs[i]];
	if i == 2 {
		result = Some(pte);
		break;
	}
	if !pte.is_valid() {
		let frame = frame_alloc().unwrap();
		// create or return None
		*pte = PageTableEntry::new(frame.ppn, PTEFlags::V);
		self.frames.push(frame);
	}
	ppn = pte.ppn();
}
```

## Page Map Design

Based on our abstraction, we need a design for `MapArea` to given a map from continuous virtual address(no matter their corresponding page!) to physical address.

```rust
// os/src/mm/memory_set.rs

pub struct MapArea {
    vpn_range: VPNRange,
    data_frames: BTreeMap<VirtPageNum, FrameTracker>,
    map_type: MapType,
    map_perm: MapPermission,
}
```

Based on continuous virtual address map, we can define discontinuous map for one app.

```rust
// os/src/mm/memory_set.rs

pub struct MemorySet {
    page_table: PageTable,
    areas: Vec<MapArea>,
}    

// impl MemorySet
fn push(&mut self, mut map_area: MapArea, data: Option<&[u8]>) {
	// map range of virtual addr in allocation in page_table
	map_area.map(&mut self.page_table);
	if let Some(data) = data {
		map_area.copy_data(&mut self.page_table, data);
	}
	self.areas.push(map_area);
}
```

In Each `MapArea` allocated for some key-value for virtual-physical addr, it will allocate the same for `PageTable` for **Frame**.

---


## Allocation Space

To open SV39, we should write instruction for `satp`:

```rust
// os/src/mm/page_table.rs

pub fn token(&self) -> usize {
    8usize << 60 | self.root_ppn.0
}

// os/src/mm/memory_set.rs

impl MemorySet {
    pub fn activate(&self) {
        let satp = self.page_table.token();
        unsafe {
            satp::write(satp);
            asm!("sfence.vma" :::: "volatile");
			// sfence.vma is a special instruction to clear `Translaton Lookaside Buffer` which is used for quick search for memory addr to reduce performance expenses.
        }
    }
}
```

Therefore, it will fill current root of physical page number as activation.

Notice that we should make instruction contigeous for `SV39` open in physical address to amend the gap of transformation of address before and after open.

### Kernel

Initiation for Kernel memory layout.

```rust
let mut memory_set = Self::new_bare();
// map trampoline
memory_set.map_trampoline();
memory_set.push(MapArea::new(
	(stext as usize).into(),
	(etext as usize).into(),
	MapType::Identical,
	MapPermission::R | MapPermission::X,
), None);
println!("mapping .rodata section");
// other layout ...
```

Initiation for App memory layout.

Previously, we will cut off `elf` part of binary of apps, now we load it and extract useful infos, s.t. Permissions.

`MemorySet` should allocate storage of execution code with its permissions, allocate user stack and trap context at top of the memory layout.

Output `MemorySet`, user stack top, entry point addr.

```rust
let mut max_end_vpn = VirtPageNum(0);
let max_end_va: VirtAddr = max_end_vpn.into();
let mut user_stack_bottom: usize = max_end_va.into();
// guard page
user_stack_bottom += PAGE_SIZE;
let user_stack_top = user_stack_bottom + USER_STACK_SIZE;
memory_set.push(MapArea::new(
	TRAP_CONTEXT.into(),
	TRAMPOLINE.into(),
	MapType::Framed,
	MapPermission::R | MapPermission::W,
), None);
// ...
```

### App

A problem is that separation of Kernel and App will also isolate **Trap**, the process need info from App to Kernel but App can't see it. Therefore, we need a transfer operation. We achieve this by storing related info in `TrapContext`.

(Because there's no more register to store these without breaking state like `sscratch` designed for kernel stack.)

```rust
// os/src/trap/context.rs

#[repr(C)]
pub struct TrapContext {
    pub x: [usize; 32],
    pub sstatus: Sstatus,
    pub sepc: usize,
	// new:
    pub kernel_satp: usize, 
    pub kernel_sp: usize,
    pub trap_handler: usize,
}
```

Notice that we also need to modify below to trigger `satp` and specify corresponding(U-level, S-level `satp`) physical page number to change state.

```
# __alltraps:

# load kernel_satp into t0
ld t0, 34*8(sp)
# load trap_handler into t1
ld t1, 36*8(sp)
# move to kernel_sp
ld sp, 35*8(sp)
# switch to kernel space
csrw satp, t0
sfence.vma
# jump to trap_handler
jr t1

# __restore:
# a0: *TrapContext in user space(Constant); a1: user space token
# switch to user space
csrw satp, a1
sfence.vma
csrw sscratch, a0
```

To amend the problem of contigeous instructions after switch, we need to adjust memory layout for `trampoline` which is in the same location in U-level and S-level(**unified for all app to trap!**). It will be placed at highest virtual page.

```
# os/src/linker.ld

    stext = .;
    .text : {
        *(.text.entry)
+        . = ALIGN(4K);
+        strampoline = .;
+        *(.text.trampoline);
+        . = ALIGN(4K);
        *(.text .text.*)
    }
```

We modify rather raw handler and restore, due to virtual address, we need to adjust it for `trampoline` rather the address we had code!(**it's virtual!**)

```rust
#[no_mangle]
pub fn trap_handler() -> ! {
    set_kernel_trap_entry();
    let cx = current_trap_cx();
    let scause = scause::read();
    let stval = stval::read();
    match scause.cause() {
        ...
    }
    trap_return();
}

#[no_mangle]
pub fn trap_return() -> ! {
    set_user_trap_entry();
    let trap_cx_ptr = TRAP_CONTEXT;
    let user_satp = current_user_token();
    extern "C" {
        fn __alltraps();
        fn __restore();
    }
    let restore_va = __restore as usize - __alltraps as usize + TRAMPOLINE;
    unsafe {
        asm!(
            "fence.i",
            "jr {restore_va}",
            restore_va = in(reg) restore_va,
            in("a0") trap_cx_ptr,
            in("a1") user_satp,
            options(noreturn)
        );
    }
    panic!("Unreachable in back_to_user!");
}
```

Then map the virtual address for it up to the physical address for unifying.

```rust
// os/src/config.rs

pub const TRAMPOLINE: usize = usize::MAX - PAGE_SIZE + 1;

// os/src/mm/memory_set.rs

impl MemorySet {
    /// Mention that trampoline is not collected by areas.
    fn map_trampoline(&mut self) {
        self.page_table.map(
            VirtAddr::from(TRAMPOLINE).into(),
            PhysAddr::from(strampoline as usize).into(),
            PTEFlags::R | PTEFlags::X,
        );
    }
}
```

We should adjust `TaskControlBlock` for the same reason, record each `Trap`.

```rust
// os/src/task/task.rs

pub struct TaskControlBlock {
    pub task_cx: TaskContext,
    pub task_status: TaskStatus,
    pub memory_set: MemorySet,
    pub trap_cx_ppn: PhysPageNum,
    pub base_size: usize,
}
```

It will read data getting from elf, get trap contexr ppn, its kernel stack bottom and top, and then initiate trap context.

Here the part of task control initiation:
```rust
impl TaskContext {
    pub fn goto_trap_return() -> Self {
        Self {
            ra: trap_return as usize,
            s: [0; 12],
        }
    }
}

// fn new(elf_data: &[u8], app_id: usize) -> Self 
let task_control_block = Self {
	task_status,
	task_cx: TaskContext::goto_trap_return(kernel_stack_top),
	memory_set,
	trap_cx_ppn,
	base_size: user_sp,
};
// prepare TrapContext in user space
let trap_cx = task_control_block.get_trap_cx();
*trap_cx = TrapContext::app_init_context(
	entry_point,
	user_sp,
	KERNEL_SPACE.exclusive_access().token(),
	kernel_stack_top,
	trap_handler as usize,
);
task_control_block
```








