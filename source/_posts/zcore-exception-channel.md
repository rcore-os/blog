---
title: "为 zCore 实现 Exception Channel 机制"
date: 2020-08-13 16:59:52
categories:
  - developer
tags:
  - author:benpigchu
  - repo:zCore
---
最近我为 zCore 实现了 zircon 的 Exception Channel 机制。下面来介绍一下 Exception Channel 机制，以及这套机制在 zCore 中的实现。
<!-- more -->
## Exception Channel 机制是什么

在 zircon 中， Exception channel 机制被用来让用户程序能够处理其他用户程序（或者自己）在运行中产生的异常，具体的介绍可以在 [Fuchsia 的文档](https://fuchsia.dev/fuchsia-src/concepts/kernel/exceptions) 中看到。接下来让我们对 Exception channel 机制作一个简单的介绍

### 如何处理异常

对于用户程序而言，要想处理其他用户程序产生的异常，首先要能操作那些用户程序对应的内核对象。在 zircon 中，我们用 [Thread](https://fuchsia.dev/fuchsia-src/reference/kernel_objects/thread)、[Process](https://fuchsia.dev/fuchsia-src/reference/kernel_objects/process)、[Job](https://fuchsia.dev/fuchsia-src/reference/kernel_objects/job) 这三个层次的任务（也就是 [Task](https://fuchsia.dev/fuchsia-src/reference/kernel_objects/task)）管理用户程序的运行。我们都知道 Thread 也就是线程是运算调度的最小单位，Process 也就是进程是内存等资源分配的最小单位，而 zircon 中的 Job 则用于进行一组进程的权限控制和资源管理，这与 Linux 的 [cgroups](https://man7.org/linux/man-pages/man7/cgroups.7.html) 类似。

有了要处理异常的 Task，就可以从这个 Task 上建立 Exception Channel 了。用户可以通过调用 [zx_task_create_exception_channel](https://fuchsia.dev/fuchsia-src/reference/syscalls/task_create_exception_channel) 这个系统调用来为 Task 创建 Exception Channel。Exception Channel 有两种：普通的以及调试用的。Thread 只有普通的 Exception Channel ，而 Process 和 Job 两者都有。对于每个 Task，每种 Exception Channel 同时最多只能有一个。

现在我们拿到 Exception Channel 了。 Exception Channel 顾名思义就是个 [Channel](https://fuchsia.dev/fuchsia-src/reference/kernel_objects/channel)。在 zircon 中 Channel 用于进行进程间通信，它除了传递数据以外它还能传递内核对象，这一点与 [UNIX domain socket](https://www.man7.org/linux/man-pages/man7/unix.7.html) 类似。对于 Exception Channel ， Channel 的另一端由内核控制，当对应的任务产生异常时，内核向会向 Exception Channel 内发送异常的简要信息，以及一个表示异常的 Exception 内核对象。

现在我们拿到了 Exception 内核对象，就可以进行异常处理了。我们可以通过 [zx_exception_get_thread](https://fuchsia.dev/fuchsia-src/reference/syscalls/exception_get_thread)、[zx_exception_get_process](https://fuchsia.dev/fuchsia-src/reference/syscalls/exception_get_process) 系统调用获取具体产生异常的进程和线程，这时我们就可以
- 通过 [zx_process_read_memory](https://fuchsia.dev/fuchsia-src/reference/syscalls/process_read_memory)、[zx_process_write_memory](https://fuchsia.dev/fuchsia-src/reference/syscalls/process_write_memory) 系统调用读写进程的内存
- 通过 [zx_thread_read_state](https://fuchsia.dev/fuchsia-src/reference/syscalls/thread_read_state)、[thread_write_state](https://fuchsia.dev/fuchsia-src/reference/syscalls/thread_write_state) 系统调用读写线程的寄存器状态
- 直接使用 [zx_task_kill](https://fuchsia.dev/fuchsia-src/reference/syscalls/task_kill) 结束线程或进程

如果我们已经成功完成了异常处理，我们应当使用 [zx_object_set_property](https://fuchsia.dev/fuchsia-src/reference/syscalls/object_set_property) 系统调用将 Exception 内核对象的 [ZX_PROP_EXCEPTION_STATE](https://fuchsia.dev/fuchsia-src/reference/syscalls/object_get_property#zx_prop_exception_state) 属性设置为已解决异常。如果发现自己无法解决异常便无需进行此操作。接下来只需使用 [zx_handle_close](https://fuchsia.dev/fuchsia-src/reference/syscalls/handle_close) 系统调用等方式消除对 Exception 内核对象的引用，这样就完成了异常的处理。此后异常要么传递给下一个 Exception Channel ，要么直接由内核进行兜底处理。

另外对于 Process 上的调试用 Exception Channel ，从这个 Channel 收到的 Exception 内核对象可以用 zx_object_set_property 系统调用将 [ZX_PROP_EXCEPTION_STRATEGY](https://fuchsia.dev/fuchsia-src/reference/syscalls/object_get_property#zx_prop_exception_state) 属性设置为允许第二次机会，这样就能够在尝试使用 Thread 和 Process 上的普通 Exception Channel 无法解决异常的情况下再次收到异常再进行处理。当然，还可以用 [zx_object_get_property](https://fuchsia.dev/fuchsia-src/reference/syscalls/object_get_property) 读取这个属性，以次得知得知 Process 上的调试用 Exception Channel 会不会有机会再次收到这个异常，以及是否确实是在Process 上的调试用 Exception Channel 的第二次机会中收到这个异常的。

### 如何抛出异常

以上我们介绍了如何使用 Exception Channel 机制处理异常。接下来我们介绍一下异常是如何产生的，以及产生异常的线程是什么行为。

线程可以产生两种异常：硬件直接产生的异常和内核生成的异常。前者由 CPU 异常中断产生，而后者由内核生成。由 CPU 产生的异常就是大家都熟悉的页错误、指令无法解析等异常中断，而内核产生的异常则有系统调用时出的触犯权限限制的异常和用于调试的 task 生命周期相关的异常（包括线程的启动与结束，以及进程的启动）。不同的 Exception Channel 可以接受的异常的类型也有不同，具体来讲：
- CPU 硬件产生的异常和触犯权限限制的异常这两种普通的异常可以被 Thread 和 Process 上的 Exception Channel，以及 Job 上的普通 Exception Channel 收到（不包含 Job 上的）。这些 Exception Channel 按一定的顺序依次试图解决异常，直到异常被在被发送到某个 Exception Channel 后被解决，或者线程被杀死，再或者最终无人成功处理时由内核处理。具体的顺序为：
	- Process 上的调试用 Exception Channel
	- Thread 上的普通 Exception Channel
	- Process 上的普通 Exception Channel
	- 如果，Exception 对象的 ZX_PROP_EXCEPTION_STRATEGY 属性被设置为了允许第二次机会， Process 上的调试用 Exception Channel 此时会再次收到异常
	- Job 上的普通 Exception Channel
	- Job 的祖先 Job 上的的普通 Exception Channel，并以此类推
- 对于线程启动与结束的异常，只有 Process 上的调试用 Exception Channel 能收到一次
- 对于进程的启动，只有 Process 的各个祖先 Job 中能收到异常的最接近叶子节点的 Job 上的调试用 Exception Channel 能收到异常

如果异常最终没能被处理，对于 CPU 产生的异常应当立即结束进程，对于触犯权限限制的异常视权限设置决定是否立即结束进程，而对于其他类型异常直接继续执行。

对于异常正在被处理的线程，它应该处于 BlockedException 状态（线程退出的异常除外），并且此时如果使用 [zx_object_get_info](https://fuchsia.dev/fuchsia-src/reference/syscalls/object_get_info) 系统调用通过传入 [ZX_INFO_THREAD](https://fuchsia.dev/fuchsia-src/reference/syscalls/object_get_info#zx_info_thread) 信息类型查看线程的信息，除了能够得知线程的状态，还应该可以得知现在是在通过什么种类的 Exception Channel 处理异常。此外如果在 zx_object_get_info 系统调用中传入 [ZX_INFO_THREAD_EXCEPTION_REPORT](https://fuchsia.dev/fuchsia-src/reference/syscalls/object_get_info#zx_info_thread_exception_report) 信息类型，还能得到线程当前的异常的基本信息。另外如果使用 zx_object_get_info 系统调用通过传入 [ZX_INFO_PROCESS](https://fuchsia.dev/fuchsia-src/reference/syscalls/object_get_info#zx_info_process) 信息类型查看进程的信息，可以看到进程有没有被建立调试用的 Exception Channel。

现在文档已经读得差不多了，可以开始实现了。

## 在 zCore 中实现 Exception Channel

zCore 中 Exception Channel 机制的实现与 zircon 中的类似，但是略有不同。接下来我们来对此进行介绍。这里列出的代码是我的 PR 中的原始代码，和现在的版本可能略有差异，但大体思路是一致的。

### Exceptionate

首先，在各种 Task 内应该有用于存放用于发送异常的结构，我们称之为 `Exceptionate` ：

```rust
pub struct Exceptionate {
	type_: ExceptionChannelType,
	inner: Mutex<ExceptionateInner>,
}

struct ExceptionateInner {
	channel: Option<Arc<Channel>>,
	thread_rights: Rights,
	process_rights: Rights,
	shutdowned: bool,
}
```

可以看到我们在 `Exceptionate` 内存放了这些信息
- Exception Channel 的类型
- 现在正在已经创建好的 Exception Channel 的发送端
- 从这里发送的 Exception 中获取的线程和进程的 Handle 应有的权限，在创建 Exception Channel 时会根据传入的 Task 的 Handle 的权限设置
- 是否已经关闭了 Exception Channel。这是为了避免在已经结束了的 Task 上创建 Exception Channel 而设置的。

现在让我们创建 Exception Channel ：

```rust
impl Exceptionate{
	pub fn create_channel(
		&self,
		thread_rights: Rights,
		process_rights: Rights,
	) -> ZxResult<Arc<Channel>> {
		let mut inner = self.inner.lock();
		if inner.shutdowned {
			return Err(ZxError::BAD_STATE);
		}
		// 检查是否已有 Channel
		if let Some(channel) = inner.channel.as_ref() {
			if channel.peer().is_ok() {
				return Err(ZxError::ALREADY_BOUND);
			}
		}
		// 创建与设置信息
		let (sender, receiver) = Channel::create();
		inner.channel.replace(sender);
		inner.process_rights = process_rights;
		inner.thread_rights = thread_rights;
		Ok(receiver)
	}
}
```

这里我们建立了一对 Channel，并将发送端保存下来，将接收端返回给调用者。在此之前我们还要检查是否已经被创建了 Exception Channel，由于 Exception Channel 被关闭时我们并不会接到通知，所以需要再检查现有的 Channel 的另一端是否已被关闭了。

### Exception 和 ExceptionObject

接下来我们来看 `Exception` 结构：

```rust
pub struct Exception {
	thread: Arc<Thread>,
	type_: ExceptionType,
	report: ExceptionReport,
	inner: Mutex<ExceptionInner>,
}

struct ExceptionInner {
	current_channel_type: ExceptionChannelType,
	thread_rights: Rights,
	process_rights: Rights,
	handled: bool,
	second_chance: bool,
}
```

在 `Exception` 结构里我们存放了这些信息
- 产生异常的的线程的引用
- 异常的类型和有关信息
- 异常处理的状态，包括
	- 当前正在使用的 Exception Channel 的信息，包括种类和能通过 Exception 获取到的线程与进程的 Handle 的权限
	- 异常是否已被解决
	- Process 上的调试用 Exception Channel 会不会有第二次机会中收到异常

这里可以发现我们的 `Exception` 结构并不是一个内核对象。这是因为内核对象的生命周期是使用 Rust 的 `Arc` 管理的，如果用户程序关闭了内核对象的 Handle，那么内核对象就直接被销毁了。如果 `Exception` 是一个内核对象，我们这时就无法继续处理异常了。所以我们的实现在其上多包一层，形成 `ExceptionObject` 内核对象：

```rust
pub struct ExceptionObject {
	base: KObjectBase,
	exception: Arc<Exception>,
	close_signal: Option<oneshot::Sender<()>>,
}

impl_kobject!(ExceptionObject);

impl Drop for ExceptionObject {
	fn drop(&mut self) {
		self.close_signal
			.take()
			.and_then(|signal| signal.send(()).ok());
	}
}
```

这样我们就可以通过实现 `Drop` trait ，在 `ExceptionObject` 被销毁时通知我们的线程当前 Exception Channel 结束了对 Exception 的操作。

接下来我们就可以将 Exception 发送到用户空间了：


```rust
impl Exceptionate{
	pub fn send_exception(&self, exception: &Arc<Exception>) -> ZxResult<oneshot::Receiver<()>>
	{
		let mut inner = self.inner.lock();
		let channel = inner.channel.as_ref().ok_or(ZxError::NEXT)?;
		// 基本信息
		let info = ExceptionInfo {
			pid: exception.thread.proc().id(),
			tid: exception.thread.id(),
			type_: exception.type_,
			padding: Default::default(),
		};
		let (sender, receiver) = oneshot::channel::<()>();
		// 把 Exception 包起来
		let object = ExceptionObject::create(exception.clone(), sender);
		let handle = Handle::new(object, Rights::DEFAULT_EXCEPTION);
		let msg = MessagePacket {
			data: info.pack(),
			handles: vec![handle],
		};
		exception.set_rights(inner.thread_rights, inner.process_rights);
		// 发送，处理 Channel 已经关闭的异常
		channel.write(msg).map_err(|err| {
			if err == ZxError::PEER_CLOSED {
				inner.channel.take();
				return ZxError::NEXT;
			}
			err
		})?;
		Ok(receiver)
	}
}
```

在发送 Exception 时，我们将 `Exception` 包进 `ExceptionObject` ，设置 `Exception` 内与 Exception Channel 有关的状态，并生成要发送的异常的基本信息结构。这里我们生成了一对 [oneshot channel](https://docs.rs/futures/0.3.5/futures/channel/oneshot/index.html) 用于通知调用者用户程序关闭了 `ExceptionObject` 的 Handle，并返回出来。如果没有可用的 Exception Channel ，我们返回 `ZxError::NEXT` 指示调用者改用别的方式处理异常。

### 处理异常

接下来我们可以开始处理异常了：

```rust
impl Exception{
	pub async fn handle(self: &Arc<Self>, fatal: bool) -> bool {
		self.handle_with_exceptionates(fatal, ExceptionateIterator::new(self), false)
			.await
	}

	pub async fn handle_with_exceptionates(
		self: &Arc<Self>,
		fatal: bool,
		exceptionates: impl IntoIterator<Item = Arc<Exceptionate>>,
		first_only: bool,
	) -> bool {
		self.thread.set_exception(Some(self.clone()));
		let future = self.handle_internal(exceptionates, first_only);
		// 这里我们需要先把 Future Pin 起来才能传进去
		pin_mut!(future);
		let result: ZxResult = self
			.thread
			.blocking_run(
				future,
				ThreadState::BlockedException,
				Duration::from_nanos(u64::max_value()),
			)
			.await;
		self.thread.set_exception(None);
		if let Err(err) = result {
			if err == ZxError::STOP {
				// 线程被 Kill
				return false;
			} else if err == ZxError::NEXT && fatal {
				// 无法处理，终结线程
				self.thread.proc().exit(TASK_RETCODE_SYSCALL_KILL);
				return false;
			}
		}
		true
	}

	async fn handle_internal(
		self: &Arc<Self>,
		exceptionates: impl IntoIterator<Item = Arc<Exceptionate>>,
		first_only: bool,
	) -> ZxResult {
		for exceptionate in exceptionates.into_iter() {
			let closed = match exceptionate.send_exception(self) {
				// 成功发送
				Ok(receiver) => receiver,
				// 直接尝试下一个 Exceptionate
				Err(ZxError::NEXT) => continue,
				Err(err) => return Err(err),
			};
			self.inner.lock().current_channel_type = exceptionate.type_;
			// 等待处理结束
			closed.await.ok();
			let handled = {
				let mut inner = self.inner.lock();
				inner.current_channel_type = ExceptionChannelType::None;
				inner.handled
			};
			if handled | first_only {
				// 若只考虑第一个 Exception Channel 或者异常以解决则直接成功
				return Ok(());
			}
		}
		Err(ZxError::NEXT)
	}
}
```

zCore 的一大特色是，在内核态使用了 async await 机制，这里我们也使用 async await 机制实现异常处理。我们的 `handle_with_exceptionates` 方法有三个参数：是否需要在无法处理异常时直接终止进程、可能收到异常的 Exception Channel 的迭代器、是否只考虑第一个接收了异常的 Exception Channel （这是为了只给第一个能收到异常的 Job 上的调试用 Exception Channel 发送进程启动的异常）。为了方便普通异常的使用，我们还增添了使用默认 Exception Channel 迭代器 `handle` 方法。

在这里，`handle_with_exceptionates` 方法调用了 `handle_internal` ，并将其返回的的 Future 扔给线程的 `blocking_run` 方法运行。这个方法会在运行前后先设置线程的状态，并且在线程被杀死的时候提前终止运行。`handle_with_exceptionates` 会检测异常处理的结果，并在需要是结束线程，它的返回值会告知调用者产生异常线程是否已经结束。

而 `handle_internal` 方法则是一个大循环，包括以下步骤：
- 从 Exception Channel 迭代器中提取 `Exceptionate`， 并调用其上的 `send_exception` 方法
- 检查是不是成功发送了异常，设置 Exception Channel 类型，并等待异常处理完成
- 判断是否完成了异常是否已被解决，并决定是退出还是继续循环

### 寻找 Exceptionate

接下来我们来介绍默认的 Exception Channel 迭代器：`ExceptionateIterator`

```rust
struct ExceptionateIterator<'a> {
	exception: &'a Exception,
	state: ExceptionateIteratorState,
}

// 各个迭代器状态，各个状态的命名代表接下来考虑哪种 Exception Channel
enum ExceptionateIteratorState {
	// 布尔值表示是否是第二次机会
	Debug(bool),
	Thread,
	Process,
	Job(Arc<Job>),
	Finished,
}

impl<'a> ExceptionateIterator<'a> {
	fn new(exception: &'a Exception) -> Self {
		ExceptionateIterator {
			exception,
			// 从 Process 的调试用 Channel 开始
			state: ExceptionateIteratorState::Debug(false),
		}
	}
}

impl<'a> Iterator for ExceptionateIterator<'a> {
	type Item = Arc<Exceptionate>;
	fn next(&mut self) -> Option<Self::Item> {
		// 如上文所说，是 Process 调试用 -> Thread -> Process
		// -> Process 调试用第二次 -> Job -> 祖先 Job 的顺序
		loop {
			match &self.state {
				ExceptionateIteratorState::Debug(second_chance) => {
					if *second_chance && !self.exception.inner.lock().second_chance {
						// 不再需要第二次机会，直接继续
						self.state =
							ExceptionateIteratorState::Job(self.exception.thread.proc().job());
						continue;
					}
					let proc = self.exception.thread.proc();
					self.state = if *second_chance {
						ExceptionateIteratorState::Job(self.exception.thread.proc().job())
					} else {
						ExceptionateIteratorState::Thread
					};
					return Some(proc.get_debug_exceptionate());
				}
				ExceptionateIteratorState::Thread => {
					self.state = ExceptionateIteratorState::Process;
					return Some(self.exception.thread.get_exceptionate());
				}
				ExceptionateIteratorState::Process => {
					let proc = self.exception.thread.proc();
					self.state = ExceptionateIteratorState::Debug(true);
					return Some(proc.get_exceptionate());
				}
				ExceptionateIteratorState::Job(job) => {
					let parent = job.parent();
					let result = job.get_exceptionate();
					self.state = parent.map_or(
						ExceptionateIteratorState::Finished,
						ExceptionateIteratorState::Job,
					);
					return Some(result);
				}
				ExceptionateIteratorState::Finished => return None,
			}
		}
	}
}
```

这里我们直接实现了 Rust 的 `Iterator` trait，这样就可以直接使用 `for in` 来取出 `Exceptionate` 的引用了。具体的实现就是经典的状态机，用 Enum 来表示接下来考虑什么类型的 Exception Channel 。另外在迭代过程中我们还读取了异常是否允许第二次机会，并以此决定是否要使用 Process 上的调试用 Exception Channel 。

### 抛出异常

接下来我们就可以在内核的其他地方生成并发送异常了。作为最典型的例子，我们来看 CPU 生成的异常如何处理。为了便于理解，下面的代码进行了许多简化。

```rust
fn spawn(thread: Arc<Thread>) {
	let vmtoken = thread.proc().vmar().table_phys();
	let future = async move {
		let mut exit = false;
		// 一旦需要线程结束就结束
		while !exit {
			let mut cx = thread.wait_for_run().await;
			if thread.state() == ThreadState::Dying {
				break;
			}
			kernel_hal::context_run(&mut cx);
			#[cfg(target_arch = "x86_64")]
			match cx.trap_num {
				0x100 => exit = handle_syscall(&thread, &mut cx.general).await,
				0x20..=0x3f => {
					// 这里省略
				}
				0xe => {
					#[cfg(target_arch = "x86_64")]
					let flags = {
						// 这里省略
					};
					match thread
						.proc()
						.vmar()
						.handle_page_fault(kernel_hal::fetch_fault_vaddr(), flags)
					{
						Ok(()) => {}
						Err(e) => {
							// 无法处理的页错误
							let exception = Exception::create(
								thread.clone(),
								ExceptionType::FatalPageFault,
								Some(&cx),
							);
							if !exception.handle(true).await {
								// 通过设置 exit 变量来退出线程
								exit = true;
							}
						}
					}
				}
				0x8 => {
					panic!("Double fault from user mode! {:#x?}", cx);
				}
				num => {
					// 其它杂七杂八的异常类型
					let type_ = match num {
						0x1 => ExceptionType::HardwareBreakpoint,
						0x3 => ExceptionType::SoftwareBreakpoint,
						0x6 => ExceptionType::UndefinedInstruction,
						0x17 => ExceptionType::UnalignedAccess,
						_ => ExceptionType::General,
					};
					let exception = Exception::create(thread.clone(), type_, Some(&cx));
					if !exception.handle(true).await {
						exit = true;
					}
				}
			}
			thread.end_running(cx);
			if exit {
				break;
			}
		}
		// 结束线程
		thread.terminate();
	};
	kernel_hal::Thread::spawn(Box::pin(future), vmtoken);
}
```

可以看到，在 zCore 中用户线程是当作一个 Future 来运行的，在运行 Future 的过程中，我们会在一个大循环里不断切换到用户态，并通过硬件中断切换回来。从用户态切换回来后，我们会对中断进行处理。对于异常的情况，我们直接根据中断编号确定异常的种类，并根据寄存器状态生成异常的基本信息，最后直接使用异常上的 `handle` 方法进行处理即可。最后根据 `handle` 方法的返回值确定是否已经终止了进程，若是则终止循环，线程也就跟着终止了。

对于其它的异常也是类似的实现方法。当然对于与 Task 生命周期相关的异常会在尝试的 Exception Channel 种类上略有不同，但是大体上差不多。最为特殊的是线程退出的异常，由于我们不一定需要等待异常处理完毕，同时需要保证一定尝试向 Process 上的调试用 Exception Channel 发送 Exception，所以我们直接使用对应 `Exceptionate` 的 `send_exception` 方法发送异常，并只在需要的时候等待异常处理完成。

## 测试 Exception Channel

现在我们实现得差不多了，可以开始测试了。Exception Channel 的测试们除了测试 Exception Channel 机制本身，同时也测试了整个 Task 模块的实现，所以接下来还会提到 Task 模块里的各种问题和细节。

### core-test

首先是 zircon 的核心测试 core-test 。在 core-test 中其实有不少使用了 Exception Channel 的测试，但是大部分是在使用 Exception Channel 来确认某些操作确实产生了异常，或是在线程启动时进行一些准备操作。对我们来说，比较重要的是 `Threads.ThreadStartWithZeroInstructionPointer` `Threads.SuspendMultiple` `Threads.KillSuspendedThread` 这几个与线程的状态有关的测试，测试的源代码可以在 [Fuchsia 的代码仓库](https://fuchsia.googlesource.com/fuchsia/+/2d323540e1cfaf3a99926f13e0b6c3c2efaea5d5/zircon/system/utest/core/threads/threads.cc) 找到。

从 `Threads.SuspendMultiple` 测试中可以发现，就算一个线程在处理异常的时候同时被 [zx_task_suspend](https://fuchsia.dev/fuchsia-src/reference/syscalls/task_suspend) 系统调用暂停了，线程的状态应该为 BlockedException 状态而非 Suspend 状态。而如果看其他测试，可以发现对于其他 Blocked 的状态， Suspend 状态会将其覆盖。这一点在 Fuchsia 的文档里没有记载，为此我改了一通 Thread 的状态转换。

### exception-test

接下来是大头：专门测试 Exception Channel 的 exception-test。exception-test 的代码可以在 [Fuchsia 的代码仓库](https://fuchsia.googlesource.com/fuchsia/+/2d323540e1cfaf3a99926f13e0b6c3c2efaea5d5/src/zircon/tests/exception/exception.cc) 找到。Fuchsia 默认不会编译 exception-test，所以我需要自行手动编译 Fuchsia。为此我下载了 Fuchsia，配了编译的环境。这里按照 [官方介绍](https://fuchsia.dev/fuchsia-src/getting_started) 就可以搞定，我只需要自行设置代理相关的环境变量即可。之后就可以开始编译了。由于 zircon 和 zCore 的实现略有区别，所以需要对 Fuchsia 代码进行些许的改变才能进行编译。具体的可以看 [zCore 仓库内的编译脚本](https://github.com/rcore-os/zCore/blob/master/scripts/gen-prebuilt.sh)。当然，因为 Fuchsia 源码有些许变动，所以我们需要手动编辑一下同文件夹下的 patch 文件，具体的这里就略过了。最后，在 `fx set` 这一行内加上 `--with-base //src/zircon/tests/exception:exception-package` 参数，我们就可以在 zCore 加载之后直接使用 exception-test 了。不过，不知为何，用我编译出来的镜像启动时会因为某种原因无法加载 `/boot/test/` 路径下的测试二进制，所以我用 Fuchsia 编译出来的 zbi 镜像操作工具把它挪到了 `/boot/bin/` 里。

在 exception-test 中还是发现了一些实现上的问题的：

- 在 `ExceptionTest.ThreadLifecycleChannelExceptions` 测试中，线程退出时无法触发线程退出的异常。这是因为杀死进程之后进程过早结束关闭了 `Exceptionate` 导致的。为此我修改了 Task 结束的行为，让 Task 在等待子 Task 完全结束后再完全终止，在此时再关闭了 `Exceptionate` 并设置信号等等。
- 在 `ExceptionTest.ProcessLifecycleJobChannel` 测试中，我们发现一个没有子 Task 的 Job 应当在引用它的 Handle 被全部关闭之后自动结束。这意味着我们存储 Job 的子 Job 的时候应该用弱引用 `Weak` 而非强引用 `Arc` ，并且应当为 Job 实现 `Drop` trait 使得它会在销毁时完成结束 Job 的过程。
- 在 `ExceptionTest.LifecycleBlocking` 测试中，我们发现对于线程退出的异常，如果线程是被杀死的，它应当发送完异常后直接结束，而如果线程是自行结束的，它应当等待异常处理。这意味着线程结束时还需要考虑它结束的方式。

至此 exception-test 中的 48 个测试除了涉及到还未实现的 [zx_thread_read_state](https://fuchsia.dev/fuchsia-src/reference/syscalls/thread_read_state) 与 [zx_thread_write_state](https://fuchsia.dev/fuchsia-src/reference/syscalls/thread_write_state) 两个系统调用的 6 个测试以外，剩下的 42 个测试都已经完全通过了。Exception Channel 的实现看来已经很完善了。

## 小结

Exception Channel 实现了之后，可以用它来对一些会触发异常的系统调用进行测试了。比如在内存相关的测试以及硬件驱动相关的测试中，可以检测这些测试中触发的页错误以及特权保护异常了。实现 Exception Channel 之后还有一个结果，就是用户程序的异常可以触发系统级的 crashsvc 了。这意味着系统会尝试为异常退出的进程生成核心转储文件了。虽然 crashsvc 还至少需要有 zx_thread_read_state 和 zx_thread_write_state 这两个系统调用、能够读取异常线程的寄存器状态，才可能完全正常工作，但至少走到到这一步算是一个很大的进步了。

至于之后的工作，一个是 zx_thread_read_state 和 zx_thread_write_state ，另一个是 Job 的权限管理机制。除此之外当然还是得修修 bug。至于更远的之后再看吧。
