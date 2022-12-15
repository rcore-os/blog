---
title: 2022开源操作系统训练营第一阶段总结-jiaxianhua
date: 2022-12-15 21:53:50
categories:
    - report
tags:
    - author:jiaxianhua
    - summerofcode2022
    - rcore-lab
---

## Rust

### 2022/10/31

2022年开源操作系统训练营

- 主页：https://github.com/LearningOS/rust-based-os-comp2022
- 开源操作系统社区: https://os2edu.cn/
- 课程培训：https://os2edu.cn/course/
- 任务中心：http://tasks.os2edu.cn/
- 学习博客：http://rcore-os.cn/blog/
- 社区排行榜：https://os2edu.cn/ranking/

<!-- more -->

### 2022/11/02

- 提交 issues schedule
- 在 Open Source OS Training Camp 2022 每日/周学习实践过程记录 repositories links #1 上更新进度。
- 学习微软课程
- 使用 Rust 迈出第一步
- 这次是在 Windows 10 上学习。

### 2022/11/03-2022/11/08

- 测试 repo: https://github.com/os2edu/rustlings-jiaxianhua
- 排名：https://os2edu.cn/ranking/rank
- Pass 72 questions
- 完成度： 76.60%
- `iterators` 还要再深入理解一下

### 2022/11/09

![rustlings_finish](https://gitee.com/iOSDevLog/rust-based-os-comp2022/raw/master/rustlings_finish.png)

### 2022/11/15 分析 Rustlings v1.0 的实现 rustlings v1.0

[分析 Rustlings 的实现](http://tasks.os2edu.cn/pc/#/taskCenter/taskDetails?id=16)

#### main

根据参数，执行不同的函数。

```rust
main():
    if not_match():
        println!("rustling");
    if match("run"):
        run(matches.clone());
    if match("verify"):
        verify();
    if match("watch"):
        watch();
    if not_match():
        print_file("default_out.md");
```

#### run

* 如果是测试文件，继续执行，否则 `panic` 报错。
    * 如果文件名有 `test`，执行测试后退出。
    * 如果调用 `rustc` 正常编译，向下执行，否则报编译错误。
        * 如果能运行生成的可执行文件，提示运行成功，否则报运行错误。

```rust
run():
    if let filename = matches.valueof("file"):
        if matches.is_present("test")
            test();
            exit(0);
        let compile_cmd = fork("rustc");
        if compile_cmd.success():
            let run_cmd = fork("a.out");
            if run_cmd.success():
                println!("✅✓ Successfully ran" + filename);
            else:
                println!("⚠️! Ran" + filename + " with errors");
        else:
            println!("⚠️! Compilation of " + filename + " failed! Compiler error message:\n");
    else:
        panic!("Please supply a filename!");
```

#### verify

遍历 `exercises` 下的文件，带有 `test` 文件名的执行测试，其他文件执行只编译。

测试和只编译只是运行 `rustc` 的参数不同。

```rust
verify():
    compile_only("xxx.rs");
    test("xxx/test.rs");

compile_only():
    compilecmd = Command::new("rustc").args(["..."]);
    if compilecmd.status.success():
        println!("✅✓ Successfully compiled " + filename);
    else:
        println!("⚠️! Compilation of " + filename + " failed! Compiler error message:\n");

test():
    compilecmd = Command::new("rustc").args(["--test", "..."]);
    // same to compile_only();
```

#### watch

2 秒执行一行 `verify()`，有错误就报错，没有就再次执行 `verify()`。

```rust
watch():
    let (tx, rx) = channel();
    let watch = Watcher::new(tx, Duration::from_secs(2))?;
    watcher.watch("./exercises", RecursiveMode::Recursive)?;

    verify();

    loop {
        match rx.recv() {
            OK {
                verify();
            },
            Err(e):
                println!(watch error: " + e);
        }
    }
```


### 2022/11/16 2022/11/16 分析 Rustlings v2.0 的实现

今天分析一下 v2.0 有什么变化。

#### rustlings dependencies

```bash
# v1.0
clap = "2.32.0" # cli args
indicatif = "0.9.0"
console = "0.6.2"
syntect = "3.0.2"
notify = "4.0.0"
# v2.0
clap = "2.32.0"
indicatif = "0.9.0"
console = "0.6.2"
notify = "4.0.0"
toml = "0.4.10"
regex = "1.1.6"
serde = {version = "1.0.10", features = ["derive"]}

[dev-dependencies]
assert_cmd = "0.11.0"
predicates = "1.0.1"
glob = "0.3.0"
```

#### info.toml

Rustlings v2.0 配置文件放到 `info.toml` 文件中。

```toml
# VARIABLES

[[exercises]]
name = "variables1"
path = "exercises/variables/variables1.rs"
mode = "compile"
hint = """
Hint: The declaration on line 5 is missing a keyword that is needed in Rust
to create a new variable binding."""
```

* *# VARIABLES*：注释，代表以下 exercises 所属分类
* *[[exercises]]*：表数组，所有练习都属于 *exercises*
* *name*：练习名称
* *path*：练习文件
* *mode*：模式，有 *compile* 和 *test* 两种
* *hint*：提示，不知道怎么做时，可以看提示

```rust
pub struct Exercise {
    pub name: String,
    pub path: PathBuf,
    pub mode: Mode,
    pub hint: String,

    pub fn compile(&self); // 根据 mode，调用 rustc 执行 compile 或者 test
    pub fn run(&self);     // 运行可生成的 temp 可执行文件
    pub fn clean(&self);   // 删除 temp 文件
    pub fn state(&self) -> State;
}
```

#### main

* 练习是从 `info.toml` 中读取的
* 根据参数，执行不同的函数
* v2.0 比 v1.0 多了 `hint`

```rust
main():
    if not_exist("info.toml"):
        exit(1);
    if !rustc_exist():
        exit(1);

    let toml_str = read_to_string("info.toml");
    let exercises = from_str(toml_str).exercises;

    if not_match():
        println!("rustling");
    if match("run"):
        let exercise = exercises.iter().find(name = matches.value_of("name"));
        run(exercise);
    if match("hint"):
        let exercise = exercises.iter().find(name = matches.value_of("name"));
        println!(exercise.hint);
    if match("verify"):
        verify(exercises);
    if match("watch"):
        watch(exercises);
    if not_match():
        print_file("default_out.md");
```

#### run

* *run(exercise)*：根据 `mode`，调用 `test` 或者 `compile_and_run`
* *test(exercise)*：调用 `compile_and_test`，稍后分析
* *compile_and_run(exercise)*：先调用编译，再调用运行

```rust
run(exercise):
    match exercise.mode {
        Mode::Test => test(exercise)?,
        Mode::Compile => compile_and_run(exercise)?,
    }

test(exercise)：
    compile_and_test(exercise, true)?;

compile_and_run(exercise):
    let compilecmd = exercise.compile();
    if compile_cmd.success():
        let run_cmd = exercise.run();
        if run_cmd.success():
            println!(green("✅✓ Successfully ran" + exercise));
        else:
            println!(red("⚠️! Ran" + exercise + " with errors"));
    else:
        println!(red("⚠️! Compilation of " + exercise + " failed! Compiler error message:\n") + compilecmd.stderr);
```

#### verify

遍历 `exercises`，根据 `mode` 调用 `compile_and_test_interactively` 或者 `compile_only`

```rust
verify(exercises):
    for exercise in exercises:
        let is_done = match exercise.mode:
            Mode::Test => compile_and_test_interactively(exercise),
            Mode::Compile => compile_only(exercise),

compile_and_test_interactively(exercises):
    compile_and_test(exercise, false)

compile_and_test(exercise, skip_prompt):
    let compile_output = exercise.compile();
    if compile_output.status.success():
        let run_cmd = exercise.run();
        if run_cmd.success():
            println!(green("✅✓ Successfully tested" + exercise));
            skip_prompt || prompt_for_completion(exercise)
        else:
            println!(red("⚠️! Compiling of " + exercise + " failed! Please try again. Here's the output:") + run_cmd.stdout);
    else:
        println!(red("⚠️! Compiling of " + exercise + " failed! Please try again. Here's the output:") + compile_output.stderr);

compile_only(exercise):
    let compilecmd = exercise.compile();
    if compilecmd.status.success():
        println!("✅✓ Successfully compiled " + filename);
        prompt_for_completion(exercise)
    else:
        println!("⚠️! Compilation of " + filename + " failed! Compiler error message:\n");

prompt_for_completion(exercise):
    let context = match exercise.state():
        State::Done => return true,
        State::Pending(context) => context,

    let success_msg = match exercise.mode:
        Mode::Compile => "The code is compiling!",
        Mode::Test => "The code is compiling, and the tests pass!",

    println!("or jump into the next one by removing the " + style("`I AM NOT DONE`").bold() +" comment:");

    for context_line in context:
        let formatted_line = if context_line.important:
            style(context_line.line).bold()
        else
            context_line.line
        show_error(formatted_line);
```

#### watch

2 秒执行一行 `verify()`，有错误就报错，没有就再次执行 `verify()`。

```rust
watch():
    let (tx, rx) = channel();
    let watch = Watcher::new(tx, Duration::from_secs(2))?;
    watcher.watch("./exercises", RecursiveMode::Recursive)?;

    verify();

    loop {
        match rx.recv() {
            OK {
                verify();
            },
            Err(e):
                println!(watch error: " + e);
        }
    }
```

#### 小结

通过对比 `compile_and_test` 和 `compile_and_run`，我们发面他们的功能基本相同。

在 `compile_and_test` 有可能会调用 `prompt_for_completion` 提示完成。

从 [CHANGELOG.md](https://github.com/rust-lang/rustlings/blob/main/CHANGELOG.md) 也可以看出:

* Reworks the exercise management to use an external TOML file instead of just listing them in the code
* 重写练习管理，使用外部 TOML 文件，而不是仅仅在代码中列出它们
* cli: check for rustc before doing anything (36a033b8)
* cli 会先检测 rustc
* hint: Add test for hint (ce9fa6eb)
* 添加测试的提示

## RISC-V 学习

从 2022 年 3 月就开始调研 [RISC-V Linux 内核剖析](https://gitee.com/tinylab/riscv-linux)。

整理了一下 [RISC-V ISA](https://gitee.com/tinylab/riscv-linux/raw/master/ppt/riscv-isa.pptx)。

## rCore 实验

因为一些事情，实验一个也没有做。准备这周未世界杯结束后，把实验也重新做一遍。

## 总结

rust 现在已经合并进 [Linux Kernel v6.1](https://kernel.org/)。

我也在 [Rust Meetup 深圳 - 2022 年 11 月 26 日](https://www.bilibili.com/video/BV1ke4y1g7AM/) 向张汉东老师提问 Rust 是否适合写操作系统。

大家普遍看好 Rust 的未来，我也希望能抽空自己用 Rust 写一个小的操作系统。
