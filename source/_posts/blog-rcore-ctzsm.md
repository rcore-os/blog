---
title: blog-rcore-ctzsm
date: 2023-11-03 21:42:13
tags:
    - author: ctzsm
    - repo: https://github.com/LearningOS/2023a-rcore-ctzsm
    - 
---

# Stage 1 (Rustling)

I tried to learn Rust programming language many times, but it was from start to give up every time. Mostly because I never used it in my real job or other personal works. The recent one was trying to implement a vulkan game engine with Rust, but I do have other stuff to do, so that was never finished.

I spent about 3 nights to finish the rustling problem set, it was fun. For the first half, it was a refresh to my already rusty Rust memory. I did learn something different during the second part. It was indeed engaging. The compiler message is a very powerful tool in general, Many times I just need to follow what the compiler said to answer the question.  I did have to Google a lot and consult The Book and the official Rust lang document.

With these practices, I started to get used to Rust, I wouldn't say I am fully equipped comparing with my C++ and Java skill, but I think it is a good start.

# Stage 2 (Lab)

## Lab 1

After setting up the environment, I realized that I had read the tutorial book before, but just brief. It was probably because I followed an OS course from Nanjing University taught by Yanyan Jiang on Bilibili. I even have a qemu installed in my WSL2. In general, the guide book is very readable. I followed the book to understand the code structure and WeChat group helped some of the common questions on newer version of qemu, which saved my a lot of time.

However, 2 weeks are super short, I can't finish reading the first two chapters to understand all the details and I have to start chapter 3 right away to meet the deadline. Fortunately the actual lab isn't very hard. The first lab is just to implement `sys_task_info`, there is a big hint that the `TaskControlBlock` has a `TaskStatus` field, we also have that in `TaskInfo` struct, I immediately realized that we just need replace that field with the `TaskInfo` struct type. The rest of the work is fairly straightfoward.

## Lab 2

This lab is indeed harder than the previous one, again I didn't have time to read the book in a great detail, so I had to make a guess sometimes. But fortunately the code itself is very readable as well, I can find all the info I need in the code. The first hint I get is the `translated_byte_buffer()` function, which reminds me `memcpy` in C/C++, if I can write a function to convert everything to a byte array, I then can use `translated_byte_buffer()` with that to easily copy data from kernel space to user space. That's exactly what I did in my code to solve this.

The second part is `mmap` and `munmap`, there are many restrictions on the params, which simplied the whole story. I am happy to see this so I can pass the test cases, but wondering how a real world OS implements them.

## Lab 3

I spent more time than before to read chapter 5, which didn' help me a ton in the lab, but I still think that is worth because it provides me some details about how this particular OS is designed.

I was planning to rewrite all of lab 2 and lab 1 requirements again, but I don't have that time, so I spent about 1 hour to do cherry-pick from ch4. The `spawn` part was easy if we understood how `fork` and `exec` work.

The `stride` part is also not too hard since the problem statement is clear about what I need to do. I did have some bugs (and I probably still have some bugs even I passed the test cases), it was not too hard to debug them. I ended with using a binary heap to implement the algorithm.

# Summary
That's all I did so far, I wish I can finish the rest two labs soon, 2 weeks are super tight, not sure why this was arranged in this way, the curves in stage 1 and stage 2 are completely different. But maybe that was on purpose, so everyboday has to find their way out, I did have fun and finally had time to get my hands on code.

Big thanks to all the hosts and staff!