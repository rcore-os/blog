---
title: rcore-handnote-6-1
date: 2025-04-27 9:40:28
categories: 
    - handnote 
tags:
    - 2025春夏季开源操作系统训练营
---
## Chapter 6-1

### Introduction

The demand of persistent storage is with growth of computer. Currently we can only store things on our map memory, but it's only exist in running time, which is **Internal Storage**, now we want to store it to **External Storage**.

### Concept

#### Regular File

```bash
cd os/src/
stat main.rs

File: main.rs
Size: 940           Blocks: 8          IO Block: 4096   regular file
Device: 801h/2049d  Inode: 4975        Links: 1
Access: (0644/-rw-r--r--)  Uid: ( 1000/   oslab)   Gid: ( 1000/   oslab)
Access: 2021-02-28 23:32:50.289925450 +0800
Modify: 2021-02-28 23:32:50.133927136 +0800
Change: 2021-02-28 23:32:50.133927136 +0800
Birth: -
```

Beside usual info, if one file is not `regular`, it's usually a block device file or character device file, whose major/minor ID will be shown.

- Links: alias name for one file
- Inode: the underneath id used to route
- Uid: the file belonged user id.
- Gid: the file begloned group id.
- Blocks: take amount of blocks(in linux, it's 4096KB).

#### Dir

```bash
stat os
File: os
Size: 4096          Blocks: 8          IO Block: 4096   directory
Device: 801h/2049d  Inode: 4982        Links: 5
Access: (0755/drwxr-xr-x)  Uid: ( 1000/   oslab)   Gid: ( 1000/   oslab)
Access: 2021-02-28 23:32:50.133927136 +0800
Modify: 2021-02-28 23:32:50.129927180 +0800
Change: 2021-02-28 23:32:50.129927180 +0800
Birth: -
```

- Access:
  - d: dir
  - r: allowed to read files and subdir
  - w: allowed to create and delete files and subdir
  - x: allowed to "pass" this dir.

#### File System

Play the role of mapping the given dir tree structure to persistent storage. For example: windows-FAT/NTPS; linux-Ext3/Ext4/Btrfs. Therefore, construct a **VFS-Virtual File System** is necessary to restrict unified interface.

---

### Design

#### Simplification

- flatten: only root dir `/`
- permission: only user and no restriction on file access
- no timestamp
- no soft/hard link
- many...

![](/rCore-Blog/assets/Lab6-1.png)

#### Cache

For a persistent external storage, it will separate file in basic storage unit. Which is called **sector**(usually 512 bytes, 4KB), rather, file system will set its own storage unit which is called **block**, usually different from sector, but in this implementation, we set it as 512 bytes, same as sector.

A basic interface from device is:
```rust
// easy-fs/src/block_dev.rs

pub trait BlockDevice : Send + Sync + Any {
    fn read_block(&self, block_id: usize, buf: &mut [u8]);
    fn write_block(&self, block_id: usize, buf: &[u8]);
}
```

File will not read and write directly often which will slow down speed, we will construct **Block Cache** to store read data. Then we unify all block cache in to a manager with limit size and used for allocation and deallocation.

```rust
// easy-fs/src/lib.rs

pub const BLOCK_SZ: usize = 512;

// easy-fs/src/block_cache.rs

pub struct BlockCache {
    cache: [u8; BLOCK_SZ],
    block_id: usize,
    block_device: Arc<dyn BlockDevice>,
    modified: bool,
}

impl BlockCache {
    pub fn read<T, V>(&self, offset: usize, f: impl FnOnce(&T) -> V) -> V {
        f(self.get_ref(offset))
    }

    pub fn modify<T, V>(&mut self, offset:usize, f: impl FnOnce(&mut T) -> V) -> V {
        f(self.get_mut(offset))
    }
}

// easy-fs/src/block_cache.rs

const BLOCK_CACHE_SIZE: usize = 16;

use alloc::collections::VecDeque;

pub struct BlockCacheManager {
    queue: VecDeque<(usize, Arc<Mutex<BlockCache>>)>,
}

impl BlockCacheManager {
    pub fn new() -> Self {
        Self { queue: VecDeque::new() }
    }
}

// impl BlockCacheManager
// fn get_block_cache(&mut self, block_id:usize, block_device: Arc<dyn BlockDevice>)
// if reach limit size:
if self.queue.len() == BLOCK_CACHE_SIZE {
    // from front to tail
    if let Some((idx, _)) = self.queue
        .iter()
        .enumerate()
        .find(|(_, pair)| Arc::strong_count(&pair.1) == 1) {
        self.queue.drain(idx..=idx);
    } else {
        panic!("Run out of BlockCache!");
    }
}
// load block into mem and push back
let block_cache = Arc::new(Mutex::new(
    BlockCache::new(block_id, Arc::clone(&block_device))
));
self.queue.push_back((block_id, Arc::clone(&block_cache)));
block_cache
```

---

#### Block Layout

![alt text](/rCore-Blog/assets/Lab6-2.png)

We will design a whole map structure to control block caches.

First is **Super Block** which is a head to control everything, notice `magic` is magic number in mathematics to check the integrity of structure.

```rust
// easy-fs/src/layout.rs

#[repr(C)]
pub struct SuperBlock {
    magic: u32,
    pub total_blocks: u32,
    pub inode_bitmap_blocks: u32,
    pub inode_area_blocks: u32,
    pub data_bitmap_blocks: u32,
    pub data_area_blocks: u32,
}

pub fn is_valid(&self) -> bool {
    self.magic == EFS_MAGIC
}
```

**Bit Map** is a nice structure to handle mapping operations, we set each block as 512 bytes(4KB), each bits represent a state of allocation(`1/0` for allocated/deallocated).

```rust
// easy-fs/src/bitmap.rs

// notice it only store the id of start block and the len of blocks in its range.
pub struct Bitmap {
    start_block_id: usize,
    blocks: usize,
}

// the true structure to map
type BitmapBlock = [u64; 64];

// equal: 4096 bits
const BLOCK_BITS: usize = BLOCK_SZ * 8;

impl Bitmap {
    pub fn alloc(&self, block_device: &Arc<dyn BlockDevice>) -> Option<usize> {
        for block_id in 0..self.blocks {
            let pos = get_block_cache(
                block_id + self.start_block_id as usize,
                Arc::clone(block_device),
            )
            .lock()
            .modify(0, |bitmap_block: &mut BitmapBlock| {
                // core!
                if let Some((bits64_pos, inner_pos)) = bitmap_block
                    .iter()
                    .enumerate()
                    .find(|(_, bits64)| **bits64 != u64::MAX)
                    .map(|(bits64_pos, bits64)| {
                        (bits64_pos, bits64.trailing_ones() as usize)
                    }) {
                    // modify cache
                    bitmap_block[bits64_pos] |= 1u64 << inner_pos;
                    Some(block_id * BLOCK_BITS + bits64_pos * 64 + inner_pos as usize)
                } else {
                    None
                }
            });
            if pos.is_some() {
                return pos;
            }
        }
        None
    }
}
```

Based on such structure, we could exposit what is **Inode** and **Data** Block, not all block will store real data because some of them need to be used as guidance. However, we also need to know where and how these route blocks be allocated. That's the reason of **Bit Map**! Now we delve into **Inode**.

To make one inode control many data blocks, we will design layer of route for it. Beside direct index, it also store the index of layer 1 and layer 2 to route other index block(which is considered same as data block), and route to real data block. Notice one block contains 512 bytes, which is 512 u8, so it contains 512/4 = 128 u32, so one index block can route 128 * 512 bytes = 128 * 0.5 KB = 64 KB in one layer. In second layer, it can route as much as 128 * 64 KB = 64 MB.

```rust
// easy-fs/src/layout.rs

const INODE_DIRECT_COUNT: usize = 28;
// 128
const INODE_INDIRECT1_COUNT: usize = BLOCK_SZ / 4;

#[repr(C)]
pub struct DiskInode {
    pub size: u32,
    pub direct: [u32; INODE_DIRECT_COUNT],
    pub indirect1: u32,
    pub indirect2: u32,
    type_: DiskInodeType,
}

#[derive(PartialEq)]
pub enum DiskInodeType {
    File,
    Directory,
}
```

Such **Inode** take 128 bytes, so in one block, it could contains 4 inodes. We should make a data structure could be fit exactly into a block size. Now we design route method.

```rust
// 28 + 128
const INDIRECT1_BOUND: usize = DIRECT_BOUND + INODE_INDIRECT1_COUNT;
type IndirectBlock = [u32; BLOCK_SZ / 4];

impl DiskInode {
    pub fn get_block_id(&self, inner_id: u32, block_device: &Arc<dyn BlockDevice>) -> u32 {
        let inner_id = inner_id as usize;
        if inner_id < INODE_DIRECT_COUNT {
            self.direct[inner_id]
        } else if inner_id < INDIRECT1_BOUND {
            get_block_cache(self.indirect1 as usize, Arc::clone(block_device))
                .lock()
                .read(0, |indirect_block: &IndirectBlock| {
                    indirect_block[inner_id - INODE_DIRECT_COUNT]
                })
        } else {
            let last = inner_id - INDIRECT1_BOUND;
            let indirect1 = get_block_cache(
                self.indirect2 as usize,
                Arc::clone(block_device)
            )
            .lock()
            .read(0, |indirect2: &IndirectBlock| {
                indirect2[last / INODE_INDIRECT1_COUNT]
            });
            get_block_cache(
                indirect1 as usize,
                Arc::clone(block_device)
            )
            .lock()
            .read(0, |indirect1: &IndirectBlock| {
                indirect1[last % INODE_INDIRECT1_COUNT]
            })
        }
    }
}
```

Now we design **Data** block, which is simple. Because for file system, any data are just bytes.

```rust
// easy-fs/src/layout.rs

// BLOCK_SZ = 512
type DataBlock = [u8; BLOCK_SZ];

// impl DiskInode
    // pub fn read_at(
    //     &self,
    //     offset: usize,
    //     buf: &mut [u8],
    //     block_device: &Arc<dyn BlockDevice>,
loop {
    // calculate end of current block
    let mut end_current_block = (start / BLOCK_SZ + 1) * BLOCK_SZ;
    end_current_block = end_current_block.min(end);
    // read and update read size
    let block_read_size = end_current_block - start;
    let dst = &mut buf[read_size..read_size + block_read_size];
    get_block_cache(
        self.get_block_id(start_block as u32, block_device) as usize,
        Arc::clone(block_device),
    )
    .lock()
    .read(0, |data_block: &DataBlock| {
        let src = &data_block[start % BLOCK_SZ..start % BLOCK_SZ + block_read_size];
        dst.copy_from_slice(src);
    });
    read_size += block_read_size;
    // move to next block
    if end_current_block == end { break; }
    start_block += 1;
    start = end_current_block;
}
```


---

#### File System

Due to our consecutive layout, we will store bitmap and start block, then initiate a unified system to control allocation and route. We call it **File System**.

```rust
// easy-fs/src/efs.rs

pub struct EasyFileSystem {
    pub block_device: Arc<dyn BlockDevice>,
    pub inode_bitmap: Bitmap,
    pub data_bitmap: Bitmap,
    inode_area_start_block: u32,
    data_area_start_block: u32,
}

impl EasyFileSystem {
    pub fn create(
        block_device: Arc<dyn BlockDevice>,
        total_blocks: u32,
        inode_bitmap_blocks: u32,
    ) -> Arc<Mutex<Self>> {
        // calculate block size of areas & create bitmaps
        let inode_bitmap = Bitmap::new(1, inode_bitmap_blocks as usize);
        let inode_num = inode_bitmap.maximum();
        let inode_area_blocks =
            ((inode_num * core::mem::size_of::<DiskInode>() + BLOCK_SZ - 1) / BLOCK_SZ) as u32;
        let inode_total_blocks = inode_bitmap_blocks + inode_area_blocks;
        let data_total_blocks = total_blocks - 1 - inode_total_blocks;
        let data_bitmap_blocks = (data_total_blocks + 4096) / 4097;
        let data_area_blocks = data_total_blocks - data_bitmap_blocks;
        let data_bitmap = Bitmap::new(
            (1 + inode_bitmap_blocks + inode_area_blocks) as usize,
            data_bitmap_blocks as usize,
        );
...
```

Use **Bit Map**, we finally know which is **Inode** and **Data**.

```rust
// easy-fs/src/efs.rs

impl EasyFileSystem {
    pub fn get_disk_inode_pos(&self, inode_id: u32) -> (u32, usize) {
        let inode_size = core::mem::size_of::<DiskInode>();
        let inodes_per_block = (BLOCK_SZ / inode_size) as u32;
        let block_id = self.inode_area_start_block + inode_id / inodes_per_block;
        (block_id, (inode_id % inodes_per_block) as usize * inode_size)
    }

    pub fn get_data_block_id(&self, data_block_id: u32) -> u32 {
        self.data_area_start_block + data_block_id
    }
}
```

Our **Disk Inode** is aims for underneath system, not for user, so we need a real **Inode** as a interface for **Disk Inode** to route, which store its id and offset.

```rust
// easy-fs/src/vfs.rs

pub struct Inode {
    block_id: usize,
    block_offset: usize,
    fs: Arc<Mutex<EasyFileSystem>>,
    block_device: Arc<dyn BlockDevice>,
}

// easy-fs/src/vfs.rs

impl Inode {
    fn read_disk_inode<V>(&self, f: impl FnOnce(&DiskInode) -> V) -> V {
        get_block_cache(
            self.block_id,
            Arc::clone(&self.block_device)
        ).lock().read(self.block_offset, f)
    }

    fn modify_disk_inode<V>(&self, f: impl FnOnce(&mut DiskInode) -> V) -> V {
        get_block_cache(
            self.block_id,
            Arc::clone(&self.block_device)
        ).lock().modify(self.block_offset, f)
    }
}
```

All methods exposed to user will be root inode.

```rust
// easy-fs/src/efs.rs

impl EasyFileSystem {
    pub fn root_inode(efs: &Arc<Mutex<Self>>) -> Inode {
        let block_device = Arc::clone(&efs.lock().block_device);
        // acquire efs lock temporarily
        let (block_id, block_offset) = efs.lock().get_disk_inode_pos(0);
        // release efs lock
        Inode::new(
            block_id,
            block_offset,
            Arc::clone(efs),
            block_device,
        )
    }
}
```

However, we still need one special data block which is **DirEntry**, as directory which store `inode_number` to route inode, **DirEntry** takes 32 bytes, so each block can store 4 **DirEntry**. Thus we can route to inode by `&str`.

Notice disk_inode contains type for dir and file. So some of inodes will store dir data and some of inodes will store file data, we can get inode of data by inode of dir.

```rust
// easy-fs/src/layout.rs

const NAME_LENGTH_LIMIT: usize = 27;

#[repr(C)]
pub struct DirEntry {
    name: [u8; NAME_LENGTH_LIMIT + 1],
    inode_number: u32,
}

pub const DIRENT_SZ: usize = 32;
```

First, we will 

```rust
// easy-fs/src/vfs.rs

impl Inode {
    pub fn find(&self, name: &str) -> Option<Arc<Inode>> {
        let fs = self.fs.lock();
        self.read_disk_inode(|disk_inode| {
            self.find_inode_id(name, disk_inode)
            .map(|inode_id| {
                let (block_id, block_offset) = fs.get_disk_inode_pos(inode_id);
                Arc::new(Self::new(
                    block_id,
                    block_offset,
                    self.fs.clone(),
                    self.block_device.clone(),
                ))
            })
        })
    }

    fn find_inode_id(
        &self,
        name: &str,
        disk_inode: &DiskInode,
    ) -> Option<u32> {
        // assert it is a directory
        assert!(disk_inode.is_dir());
        let file_count = (disk_inode.size as usize) / DIRENT_SZ;
        let mut dirent = DirEntry::empty();
        for i in 0..file_count {
            // note assert_eq! has side effect: read data to dirent.
            assert_eq!(
                disk_inode.read_at(
                    DIRENT_SZ * i,
                    dirent.as_bytes_mut(),
                    &self.block_device,
                ),
                DIRENT_SZ,
            );
            if dirent.name() == name {
                return Some(dirent.inode_number() as u32);
            }
        }
        None
    }
}
```

Usually, the workflow of create or delete, read or write would be:
- read/write
    - get root inode which is dir type
    - read/write closure of disk inode through root inode
    - resize specified inode
- create/clear
    - allocation/deallocation: alloc/dealloc inode by bitmap and get its index
    - initialization/clear by get its block cache by its index
    - resize root inode

 








