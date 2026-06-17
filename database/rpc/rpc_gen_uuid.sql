  /*
  ╔═══════════════════════════════════════════════════════════════╗
  ║                      rpc_gen_uuid()                           ║
  ║           Human-readable sortable UUID generator              ║
  ╠═══════════════════════════════════════════════════════════════╣
  ║  Output pattern:                                              ║
  ║    YYYYmmDD-HHMM-90SS-8ms-xxxxxxxxxxxx                        ║
  ║                                                               ║
  ║  Example:                                                     ║
  ║    20260611-1423-9055-8057-1a2b3c4d5e6f                       ║
  ║    └──────┘ └──┘ └┘└┘ └┘└─┘ └─────────┘                       ║
  ║    │        │    │ │  │ │    │                                ║
  ║    │        │    │ │  │ │    └── 48-bit random (12 hex chars) ║
  ║    │        │    │ │  │ └─────── milliseconds  (000–999)      ║
  ║    │        │    │ │  └───────── variant '8'   (RFC 4122)     ║
  ║    │        │    │ └──────────── seconds        (00–59)       ║
  ║    │        │    └────────────── version marker (fixed '90')  ║
  ║    │        └─────────────────── hour + minute  (HH24MI)      ║
  ║    └──────────────────────────── date           (YYYYMMDD)    ║
  ║                                                               ║
  ║  Properties:                                                  ║
  ║    • Valid PostgreSQL uuid type                               ║
  ║    • Sortable by time (ORDER BY id = ORDER BY created_at)     ║
  ║    • Human-readable datetime prefix (no hex decode needed)    ║
  ║    • '90' version marker distinguishes from standard UUIDs    ║
  ║    • '8' variant required by RFC 4122 spec                    ║
  ║    • Digits 0-9 only in datetime parts (valid hex, readable)  ║
  ║    • ~281 trillion unique values per millisecond              ║
  ║                                                               ║
  ║  Design notes:                                                ║
  ║    • Uses sql (not plpgsql) for query planner inlining        ║
  ║    • Single to_char() call for all datetime parts             ║
  ║    • gen_random_bytes(6) = 48 bits of randomness              ║
  ║    • SS max=59, MS max=999 — both safe decimal-only values    ║
  ╚═══════════════════════════════════════════════════════════════╝
  */


DROP FUNCTION IF EXISTS rpc_gen_uuid() CASCADE;

CREATE FUNCTION rpc_gen_uuid()
RETURNS uuid
LANGUAGE sql
AS $$
  SELECT (
    -- Single to_char() call builds the entire datetime prefix at once.
    -- Format mask positions map directly to UUID hyphen structure:
    --   YYYYMMDD  → part1 (8 chars)
    --   HH24MI    → part2 (4 chars)
    --   "90"SS    → part3 (4 chars): fixed marker '90' + zero-padded seconds
    --   "8"MS     → part4 (4 chars): RFC4122 variant '8' + zero-padded milliseconds
    -- Literal strings in to_char() are wrapped in double quotes.
    to_char(clock_timestamp(), 'YYYYMMDD-HH24MI-90SS-8MS-')
    
    -- Append 6 random bytes encoded as 12 hex chars for the random tail.
    -- 6 bytes = 48 bits = 16^12 ≈ 281 trillion combinations per millisecond.
    || encode(gen_random_bytes(6), 'hex')
  -- Cast the assembled 36-char string to native uuid type.
  -- PostgreSQL validates format and variant bits on cast.
  )::uuid;
$$;