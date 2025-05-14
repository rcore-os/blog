---
title: arceos-handnote-2
date: 2025-04-27 9:40:28
categories: 
    - handnote 
tags:
    - 2025春夏季开源操作系统训练营
---
## Day-2

## Paging

We delve into paging.

### Example

```rust
/// Physical address for pflash#1
const PFLASH_START: usize = 0x2200_0000;

#[cfg_attr(feature = "axstd", no_mangle)]
fn main() {
    // Makesure that we can access pflash region.
    let va = phys_to_virt(PFLASH_START.into()).as_usize();
    let ptr = va as *const u32;
    unsafe {
        println!("Try to access dev region [{:#X}], got {:#X}", va, *ptr);
        let magic = mem::transmute::<u32, [u8; 4]>(*ptr);
        println!("Got pflash magic: {}", str::from_utf8(&magic).unwrap());
    }
}
```

**PFlash** is the simulation of flash memory of qemu. When qemu boot, it will automatically load file to fixed **MMIO**, and can be directly accessed.

**Paging**: `feature = ["paging"]` is the way to evoke virtual memory management tu support `MMIO`. Located in `axruntime`.

The workflow would be:
- qemu fdt: from `0x0c00_0000` to `0x3000_0000`. Construct the space of device.
- SBI: from `0x8000_0000` to `0x8020_0000`. RISC-V **Supervisor Binary Interface**, it construct a interface for programming language to manipulate device level things.
- Kernel Image: from `0x8020_0000`. `_skernel` contains S-level things like static data, code etc... `_ekernel` is user thing.

```rust
#[link_section = ".data.boot_page_table"]
static mut BOOT_PT_SV39: [u64; 512] = [0; 512];

unsafe fn init_boot_page_table() {
    // 0x8000_0000..0xc000_0000, VRWX_GAD, 1G block
    BOOT_PT_SV39[2] = (0x80000 << 10) | 0xef;
    // 0xffff_ffc0_8000_0000..0xffff_ffc0_c000_0000, VRWX_GAD, 1G block
	// shift 10 bits to store flags
    BOOT_PT_SV39[0x102] = (0x80000 << 10) | 0xef;
}

unsafe fn init_mmu() {
    let page_table_root = BOOT_PT_SV39.as_ptr() as usize;
    satp::set(satp::Mode::Sv39, 0, page_table_root >> 12);
    riscv::asm::sfence_vma_all();
}
```

Each entry of page table will map 1G(`0x4000_0000`) memory. From `0x8000_0000` to `0xc0000_0000` at `pgd_idx = 2` to `0xffff_ffc0_8000_0000` to `0xffff_ffc0_c000_0000` at `pgd_idx = 102`. This will map to a bigger range.

## Task

###	Example

```rust
let worker = thread::spawn(move || {
	println!("Spawned-thread ...");

	// Makesure that we can access pflash region.
	let va = phys_to_virt(PFLASH_START.into()).as_usize();
	let ptr = va as *const u32;
	let magic = unsafe {
		mem::transmute::<u32, [u8; 4]>(*ptr)
	};
	if let Ok(s) = str::from_utf8(&magic) {
		println!("Got pflash magic: {s}");
		0
	} else {
		-1
	}
});
```

Each task will be in concurrency and dispatched by strategy. If it's blocked, it will be moved to `wait_queue` to wait. If it's ready, it will be moved to `run_queue` which is scheduler to be dispatched.

### Message Communication

### Example

```rust
    let q1 = Arc::new(SpinNoIrq::new(VecDeque::new()));
    let q2 = q1.clone();

    let worker1 = thread::spawn(move || {
        println!("worker1 ...");
        for i in 0..=LOOP_NUM {
            println!("worker1 [{i}]");
            q1.lock().push_back(i);
            // NOTE: If worker1 doesn't yield, others have
            // no chance to run until it exits!
            thread::yield_now();
        }
        println!("worker1 ok!");
    });

    let worker2 = thread::spawn(move || {
        println!("worker2 ...");
        loop {
            if let Some(num) = q2.lock().pop_front() {
                println!("worker2 [{num}]");
                if num == LOOP_NUM {
                    break;
                }
            } else {
                println!("worker2: nothing to do!");
                // TODO: it should sleep and wait for notify!
                thread::yield_now();
            }
        }
        println!("worker2 ok!");
    });
```

**Cooperative Scheduling**: Each tasks kindly yield themselves or exit otherwise it will block everyone because the power of CPU occupation is ownned by each tasks.

**Preemptive Scheduling**: Each tasks will be automatically suspended by external condition: No lock, no device access; inner condition: run out of current time slice. We can use a `disable_count` to record this, even for multiple condition restriction, we can sum them up.

```rust
    axhal::irq::register_handler(TIMER_IRQ_NUM, || {
        update_timer();
        #[cfg(feature = "multitask")]
        axtask::on_timer_tick();
    });

    // Enable IRQs before starting app
    axhal::arch::enable_irqs()
```

`on_timer_tick` will be trigger in time slice. When time ticker ticks, `run_queue` will check and suspend task if possible.

We can make it more dynamic. Which means each task has priority and during the implementation of cpu, each task has a `vruntime` to be dynamically adjusted by `init_vruntime + (delta/weight(nice))` where `delta` and `nice` are dynamic adjustment number. `delta` will be incremented by `timer`, `weight(nice)` is actually the priority of the task. We ensure that task with lowest `vruntime` will be placed at top.




