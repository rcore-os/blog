---
title: 2025春夏操作系统训练营第三阶段总结-heirish
date: 2025-05-16 22:17:17
tags:
    - author:heirish
    - repo: https://github.com/LearningOS/2025s-arceos-heirish
---

### 总结
有了第二阶段的基础，第三阶段相对更好理解了，有些第二阶段有点模糊的在第三阶段也更清晰了，第三阶段作业相比第二阶段更简单。
- ex1 print_with_color: 2025.05.06
   先是axhal中修改了，没处理好换行符，导致后面的练习通不过，后换成在ulib里修改
- ex2 hashmap 2025.05.07: 主要参考std中的hashmap
- ex3 bump allocator 2025.05.09: 参考了现有的allocator中的写法,key points:1.四个位置指针，2. allocate时的alignment处理和overlap检查, 3.由于是连续的分配，目前不支持dealloc，足以通过ci了
- ex4 sys_mmap 2025.05.13:找空闲区域，映射找到的区域到新分配的物理内存，加载文件内容到映射好的地址。
- ex5 ramfs_rename 2025.05.14:最刚开始按slides中的完成的是examples/shell,是fatfs, 5.14补做这个ramfs练习
- ex6 simple-hv 2025.05.16: 主要理解指令引发异常后， 会调用_guest_exit, 是通过设置stvec设置trap处理入口地址为_guest_exit , _guest_exit执行完成后就返回到_run_guest的返回地址，执行一下条指令，即vmexit_handler