## stage4总结

stage 4 算是很扎实的一个阶段。这个阶段从头开始学习了我原来不怎么熟悉的异步运行时。整体上来说算是比较系统的学习了如何构建一个异步运行时，同时也阅读了不少tokio这种生产环境级别的异步运行时代码，受益良多。
本阶段还学习了一些关于 uring io 的知识，同时也顺便比较系统的梳理了 linux io 这块的知识点。通过每周一次的交流活动中能比较有效的调整自己的学习方向，同时也能补充很多有用的信息。很多同学水平很高，在交流过程中深感差距，还需要不断学习。

## stage4 工作进度
### 本周工作（第一周）：

阅读以下两个链接中文档，比较系统的了解了 rust 的异步原理
- Writing an OS in Rust async/await
- https://rust-lang.github.io/async-book/

####下周安排（第二周）：

- 阅读 tokio 源码，学习生产环境中的异步运行时实现

### 本周工作（第二周）：

由于本项目最终要实现一个基于 uring io 的异步运行时，于是决定从 io 的角度切入 tokio 的源码阅读。在阅读过程中发现 tokio 的文件 io 部分都是转发给某个独立线程，是基于阻塞式的操作。为了对比文件 io ，还阅读了部分 tcp 相关的源码，证实了的确网络 io 是使用了基于 epoll 的 mio 来做管理。而且本周对 uring io 有一个粗略地了解，目前看来 uring io 在文件 io 方面可能优势会更明显。 网络 io 这块相较于 epoll 优势没那么大，那么接下来第三周可能要优先实现基于 uring io 的文件 io 异步运行时的相关工作。

此外本周还阅读了以下资料
- 群友关于 smol 的博客
https://systemxlabs.github.io/blog/smol-async-runtime/
- uring_io 在 smol 中实现相关的 issue
https://github.com/smol-rs/async-fs/issues/24
https://github.com/smol-rs/async-io/issues/39
- tokio uring io
https://github.com/tokio-rs/tokio-uring
这么看下来 smol 更为精简，而且文件 io 也是基于阻塞式操作。而且社区中也有想要让 smol 支持 uring io 的讨论，也许尝试移植一下 smol 会更有意思？

#### 下周安排（第三周）：

编写一个简易的基于 uring io 的文件 io 的异步运行时。

### 本周工作（第三周）：

本周首先调研了一下在 smol 中实现基于 uring io 的可能性。首先 smol 社区中已经有一个 PR
async-io PR:Integrate io_uring in the Reactor 
● 简要介绍了实现思路，
● 作者说要等等 [polling Expose raw handles for the Poller](https://github.com/smol-rs/polling/pull/39)  这个 issuing合并.
大概粗略浏览了一下，但是由于对 uring io 不太熟悉用法，还没有看懂，暂时搁置。

然后继续阅读了 uring io 的相关资料，包括
- https://kernel.dk/io_uring.pdf通过这个文档比较系统的了解了io uring 的背景和、原理和用法。
- https://github.com/tokio-rs/tokio-uring tokio 官方实现的基于 uring io 的异步运行时，在实现我自己的异步运行时的时候接口和一些比较棘手的问题有大量参考里面的实现方式。
- https://github.com/tokio-rs/io-uringtokio 官方封装的 io uring 库。我的异步运行时也基于这个库。
- https://rustmagazine.github.io/rust_magazine_2021/chapter_12/monoio.html参考这个文档，对基于 uring io 的异步运行时实现上可能遇到的问题和解决方案有了一个大概了解。

最后是实现我自己的uring io异步运行时
我的async-fs-uring，这里实现了一个建议的基于 reactor 模式异步运行时，并实现了基于uring io的文件读。主要思想就是把 io 委托给 reactor 去提交，然后 reactor 不断轮询，如果有 io 完成了，就返回给对应的异步任务。实现过程中比较困难的点就是buf 管理，需要保证 buf 在异步读过程中一直有效。我这里做法是直接把 buf 的所有权移交给 UringReadFuture.这只是一个权宜之计，因为我这里实现的比较简单，在异步读进行过程中 UringReadFuture不会被 drop 掉。实际上后来也阅读了 tokio-uring 的相关设计文档，也了解到了一些更合理的设计方案，但是还没有时间来实现。

未来计划：通过实现一个建议的基于 uring io 的异步运行时让我对 uring io 有了基本的了解。后续可能会进一步了解生产环境级的基于 uring io 的异步运行时的实现以及与传统阻塞式和epoll结合的异步运行时的实现差异

