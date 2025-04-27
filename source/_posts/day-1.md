---
title: arceos-handnote-1
date: 2025-04-27 9:40:28
categories: 
    - handnote 
tags:
    - 2025春夏季开源操作系统训练营
---
## Day-1

## Component Kernel

Based on experiment, we will construct kernel in increment by demand.

- **UniKernel**: Single S-Level, App is within kernel.

Each kernel instance can be considered as a construction based on unikernel.

- **MacroKernel**: Manage U-Level with support on multiple apps, process management etc...
- **Hypervisor**: Virtual state with restricted communication between U-level and S-level.

## Aceros Design

```mermaid
graph TD
    App <--> Runtime
    Runtime <--> HAL
```
The design of Aceros is simple, first **HAL**(`axhal`) is the abstraction of hardware to initiation trap, stack, MMU, registers based on various architectures. Then **Runtime**(`ax*`) will be classified as many components to support various environments, like net, task, fs etc...

Each arrow is reversible, in boot, it will be from bottom to top to initiate App. Then when App call something, it will be from top to bottom to evoke functionality.

In real situation, we choose thing based on *features*. 
```mermaid
graph TD
	App --> axstd
	axstd --> |axfeat| aceros_api
	aceros_api --> axruntime
	axruntime -->|alloc| axalloc
	axruntime --> axhal
	axruntime -->|irq| irq
	axruntime -->|multitask| axtask
```


