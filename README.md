# Kelvin

An encrypted, shardable NoSQL database management system (affectionally referred to as a "Vault") backed by primitive key-value storage, with padded entries and obfuscated storage access.

## Background

Designed to meet a very sepcific set of requirements:
 - All contents must be encrypted
 - Backing storage layer is a primitive key-value store, where the values can only be strings/bytes/JSON, e.g., `localStorage`, `chrome.storage.local.`, and so on
 - Database is self-describing and migrateable, i.e., no client-side dependencies, no hard-coded schemas
 - Allows for arbitrary "intra-and-inter-table" indexes
 - Must treat relations as first-class citizens
 - Must be transactional, idemptotent, and capable of rollback or recovery on failure (e.g., as a result of an interuptted transaction)
 - Must be resistant to storage access pattern analysis

Additional objectives:
 - Minimize storage footprint on disk
 - Simple and developer-friendly API
 - Performant reads

Details:
 - Data is sharded across key-value entries using padded & encrypted "buckets" (all buckets have a constant size on disk, making them indistinguishable from one another)
 - All key-value entries are routinely re-encrypted using nonces, including after each batch of write operations. This helps protect against storage access pattern analysis for writes, however currently no consideration is made for reads
 - The plaintext form of all data and metadata are serialized as JSON (as opposed to a more space-efficient format such as CBOR) in order to take advantage of the inherently more performant JSON ser/de methods. Consequently, tuples (e.g., `[a, b]`) are often used to store the bulk of data
 - The schema of an object is stored in the metadata of its containing Bucket. This provides the means for applications to be able to read from older versions. Applications can migrate data to new schemas, such as deleting properties, adding new properties, changing property names or types, etc. However, this process is left up to the developer and must be excercised with caution


Terminology relevant to API consumers:
 - **Item** - roughly equivalent to a Row in RDBMS, or an Object in Document-oriented DBMS. Capable of storing anything that can be serialized to a JSON object
 - **Domain** - roughly equivalent to a Table in RDBMS. Describes a collection of Items that share the same shape of their top-level object properties (i.e., the shapes of nested objects may differ)


Terminology relevant to contributors:
 - **Bucket** - logically organizes the storage of Items such that any Domain can be sharded across entries in the backing key-value store
 - **Sequence** - an immutable, sparse, distinct array of strings where each position corresponds to a value's key, e.g., `["~RESERVED~", "alice", "bob"]` represents `{1: "alice", 2: "bob"}` and its inverse: `{"alice": 1, "bob": 2}`

