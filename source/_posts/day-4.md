---
title: arceos-handnote-4
date: 2025-04-27 9:40:28
categories: 
    - handnote 
tags:
    - 2025春夏季开源操作系统训练营
---
## Day-4

### Hypervisor

A physical computer system can build multiple virtual computer system with its own virtual resources. Just like apps in U-level, each virtual system will consider themselves uniquely occupies these resources.

**Emulator** like a interpretor to stimulate a virtual system while in loose demand of efficiency.

**Hypervisor** will execute most instructions directly as a isomorphism of the stimulated virtual system to gain a huge efficiency.

***I** type*: Each virtual OS is equal on hardware.
***II** type*: Virtual OS is on host OS. 

Each instance as **Guest(OS Image)** be loaded on our host os kernel.

### Design

Only focus on hypervisor(I type).

Levels are extended, because we need to separate host and guest, so U-Level become U, VU-Level. So does the kernel level because we need to separate host, the hypervisor and guest, the virtual OS. So S-Level become HS, VS-Level.

#### Communication

Instructions will be implemented in communication of `HS` and `VS`, when there's a `sbi-call`, `VS` will communicate `HS` to implement.

In `hstatus` of RISC-V, design the virtualization mode:

`SPV`: the source of `HS` or `VS`, which determines the `sret` to `VU` or `U`.
`SPVP`: the permission of modification of memory that `HS` to `V`.

We need to store guest context and host context, then switch between `ret(VM-Exit)` and `sret`. We implement this by `run_guest` and `guest_exit` which both is the other's reverse.

---

Timer will be injected to `sbi-call` by setting a virtual clock in `VS`, when `set timer`, we clear timer of guest and set timer of host; when `interrupt`, we set clear timer of host and set timer of guest waiting for next request of timer.

---

Memory will be separated based on guest and host too. `GVA` will be a map of `GPA` as guest memory. However, `HPA` take responsibility of handle `GPA` as the virtualization process.

---
Dev will record each start `vaddr` and when `VM-Exit` of `PageFault`, it will find`vmdevs.find(addr)` and call `handle_mmio` for corresponding request.


