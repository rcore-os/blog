---
title: 2024三阶段总结
date: 2024-12-03  22：30
tags:
---

# 2024三阶段总结

## Unikernel

>- print_with_color 
>
>简单的利用ascll字符实现颜色
>- support_hashmap
>
>看群内大佬讨论，就引了一个库
>- alt_alloc
>
> 这个难度不大，因为测例很简单。严格实现后我确实也不知道自己实现的正确与否
>- shell
>
> 原shell实现了有关rename的，rename我就直接调库了，然后通过创建文件、copy文件内容、删除原文件拼接除了mv的功能
>
>- 1115挑战（内存调度算法实现优化）
>
> 说来惭愧，我这个印象最深。我写了3次，第一次好像是80多，第二次直接没跑起来，第三次是链表指针不知道指到哪里去了....反正都没超过170,也就没提交....
>

## 宏内核


>- page_fault
>
> 难度适中？ 感觉就是rcore上了一点
>- sys_map
>
> 就find_free_area然后read进去，虽然感觉用find_free_area找到的地方有些不符合man mmap的说明。
## Hypervisor

第一次了解hypervisor具体是怎么操作、干了什么....涨知识了...

>- simple_hv
>
> 改一下guest的sepc，设置一下a0、a1的值
>- pflash设备模拟方式
>
> 一开始没有搞清gpa映射到hpa时，没有经过host的satp，导致在host中拿着pa当va来用，出现了问题。另外，在完成后，修改了一下pflash的内容，想要读u128转string输出，但是没想到，在对* u128解引用时，它居然会先读u128的高64位，导致映射时页面没对齐。

# 2024四阶段总结 - Starry-Next 项目二方向一 感想

#  仓库链接: https://github.com/yjymosheng/Starry-On-ArceOS/tree/main

#  最终 commit ID: 71650c57f8ef9a64a6bdf274d9890b5c0c96642d

#  目前进展: 
已经完成的syscall 

![a](https://github.com/user-attachments/assets/835aaaf3-a3a4-4fc4-9214-f5c58e8af0f2)

没有完成的syscall 

![b](https://github.com/user-attachments/assets/7a21edfe-817f-4f42-84ed-fe0e488d6122)


### 个人感想 :  

这时我第二次参加os训练营,第一次的时候连rcore都没有完成,这一次由于对syscall的理解不够,相比其他同学浪费了很多时间在img的调试上.

可能下一次就能拿到优秀学员证书了也说不定?一次更比一次强嘛

虽然我的四阶段的学习可能差强人意,但是对我来说算是打开了操作系统的大门,希望明年的操作系统大赛上,能够有新的突破.

通过这次训练营，我进行了第一次对操作系统的尝试,与还对系统调用有了更加全面的认识。编写一个自己的操作系统不再只是纸上谈兵，而是一种有希望实现的技术。回顾整个过程，既有苦涩，也有喜悦，更重要的是，这让我对操作系统这条路充满了信心和期待。

希望未来，我能够在操作系统道路上走得更远，探索更多未知的可能性！