import { assertEquals, assertStrictEquals } from "jsr:@std/assert";
import { StreamingJSONParser } from "@/streaming-results-json-parser.ts";

/**
 * Creates a ReadableStream<Uint8Array> from a given string.
 * Optionally, you can provide multiple chunks to simulate partial data arrival.
 * @param {string[]} chunks - The chunks of strings to yield.
 * @returns {ReadableStream<Uint8Array>}
 */
function createStreamFromChunks(chunks: string[]): ReadableStream<string> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

Deno.test("Parses a single object in the results array", async () => {
  const json = `{
    "results": [
      {"id":1,"name":"Alice"}
    ]
  }`;

  const entries: unknown[] = [];
  const stream = createStreamFromChunks([json]);
  const parser = new StreamingJSONParser({
    onNewEntry: (entry) => {
      entries.push(entry);
    }
  });

  await parser.parseStream(stream);
  
  assertEquals(entries.length, 1);
  assertEquals(entries[0], { id: 1, name: "Alice" });
});

Deno.test("Parses multiple objects in the results array", async () => {
  const json = `{
    "results": [
      {"id":1,"name":"Alice"},
      {"id":2,"name":"Bob"},
      {"id":3,"name":"Charlie"}
    ]
  }`;

  const entries: unknown[] = [];
  const stream = createStreamFromChunks([json]);
  const parser = new StreamingJSONParser({
    onNewEntry: (entry) => {
      entries.push(entry);
    }
  });

  await parser.parseStream(stream);

  assertEquals(entries.length, 3);
  assertEquals(entries[0], { id: 1, name: "Alice" });
  assertEquals(entries[1], { id: 2, name: "Bob" });
  assertEquals(entries[2], { id: 3, name: "Charlie" });
});

Deno.test("Parses nested objects and arrays inside the result entries", async () => {
  const json = `{
    "results": [
      {
        "id":1,
        "nested":{
          "foo":"bar",
          "list":[{"val":10},{"val":20}]
        }
      },
      {
        "id":2,
        "deeplyNested":{
          "level1":{
            "level2":{
              "key":"value"
            }
          }
        }
      }
    ]
  }`;

  const entries: unknown[] = [];
  const stream = createStreamFromChunks([json]);
  const parser = new StreamingJSONParser({
    onNewEntry: (entry) => {
      entries.push(entry);
    }
  });

  await parser.parseStream(stream);

  assertEquals(entries.length, 2);

  assertEquals(entries[0], {
    id: 1,
    nested: {
      foo: "bar",
      list: [
        { val: 10 },
        { val: 20 }
      ]
    }
  });
  
  assertEquals(entries[1], {
    id: 2,
    deeplyNested: {
      level1: {
        level2: {
          key: "value"
        }
      }
    }
  });
});

Deno.test("Parses objects streamed in multiple chunks", async () => {
  // We split the JSON across multiple chunks to simulate streaming
  const chunks = [
    `{\n"results":[\n{`,
    `"id":1,"name":"Al`,
    `ice"},{`,
    `"id":2,"name":"Bob"}\n]\n}`
  ];

  const entries: unknown[] = [];
  const stream = createStreamFromChunks(chunks);
  const parser = new StreamingJSONParser({
    onNewEntry: (entry) => {
      entries.push(entry);
    }
  });

  await parser.parseStream(stream);


  assertStrictEquals(entries.length, 2);
  assertEquals(entries[0], { id: 1, name: "Alice" });
  assertEquals(entries[1], { id: 2, name: "Bob" });
});

Deno.test("Handles empty results array", async () => {
  const json = `{"results":[]}`;

  const entries: unknown[] = [];
  const stream = createStreamFromChunks([json]);
  const parser = new StreamingJSONParser({
    onNewEntry: (entry) => {
      entries.push(entry);
    }
  });

  await parser.parseStream(stream);

  assertEquals(entries.length, 0);
});

Deno.test("Handles whitespace and formatting variations", async () => {
  const json = `{
    "results" : [
       { "id" : 10,   "name" : "Dora" },
       {  "id"  :11,  "name":    "Eve" }
    ]
  }`;

  const entries: unknown[] = [];
  const stream = createStreamFromChunks([json]);
  const parser = new StreamingJSONParser({
    onNewEntry: (entry) => {
      entries.push(entry);
    }
  });

  await parser.parseStream(stream);

  assertEquals(entries.length, 2);
  assertEquals(entries[0], { id: 10, name: "Dora" });
  assertEquals(entries[1], { id: 11, name: "Eve" });
});

Deno.test("Parses five entries with arrays and nested objects", async () => {
  // We split JSON across multiple chunks with 5 entries
  const chunks = [
    `{\n"resu`,
    `lts":[\n{`,
    `"id":1,`,
    `"tags":["new",`,
    `"featured"],`,
    `"details":{"level":"beginner"}},`,
    `{"id":2,`,
    `"tags":["sale"],`,
    `"details":{"level":"intermediate"}},`,
    `{"id":3,`,
    `"tags":["featured"],`,
    `"details":{"level":"advanced"}},`,
    `{"id":4,`,
    `"tags":["new",`,
    `"sale"],`,
    `"details":{"level":"beginner"}},`,
    `{"id":5,`,
    `"tags":[`,
    `],`,
    `"details":{"level":"expert"}`,
    `}\n]\n}`
  ];

  const entries: unknown[] = [];
  const stream = createStreamFromChunks(chunks);
  const parser = new StreamingJSONParser({
    onNewEntry: (entry) => {
      entries.push(entry);
    }
  });

  await parser.parseStream(stream);

  assertStrictEquals(entries.length, 5);
  assertEquals(entries[0], { id: 1, tags: ["new", "featured"], details: { level: "beginner" } });
  assertEquals(entries[1], { id: 2, tags: ["sale"], details: { level: "intermediate" } });
  assertEquals(entries[2], { id: 3, tags: ["featured"], details: { level: "advanced" } });
  assertEquals(entries[3], { id: 4, tags: ["new", "sale"], details: { level: "beginner" } });
  assertEquals(entries[4], { id: 5, tags: [], details: { level: "expert" } });
});

Deno.test("Parses complex nested structures in chunks", async () => {
  const chunks = [
    `{\n"results":[\n{`,
    `"id":1,"metadata":{"created":{"date":"2023-01-01","by":"system"},"stats":[`,
    `{"metric":"views","count":100},{"metric":"likes","count":50}]},`,
    `"categories":[{"main":"tech","sub":["web","api"]}]},`,
    `{"id":2,"metadata":{"created":{"date":"2023-01-02","by":"user"},"stats":[`,
    `{"metric":"views","count":200},{"metric":"likes","count":75}]},`,
    `"categories":[{"main":"design","sub":["ui","ux"]}]}\n]\n}`
  ];

  const entries: unknown[] = [];
  const stream = createStreamFromChunks(chunks);
  const parser = new StreamingJSONParser({
    onNewEntry: (entry) => {
      entries.push(entry);
    }
  });

  await parser.parseStream(stream);

  assertStrictEquals(entries.length, 2);
  assertEquals(entries[0], {
    id: 1,
    metadata: {
      created: {
        date: "2023-01-01",
        by: "system"
      },
      stats: [
        { metric: "views", count: 100 },
        { metric: "likes", count: 50 }
      ]
    },
    categories: [
      { main: "tech", sub: ["web", "api"] }
    ]
  });
  assertEquals(entries[1], {
    id: 2,
    metadata: {
      created: {
        date: "2023-01-02",
        by: "user"
      },
      stats: [
        { metric: "views", count: 200 },
        { metric: "likes", count: 75 }
      ]
    },
    categories: [
      { main: "design", sub: ["ui", "ux"] }
    ]
  });
});


Deno.test("Parses GitHub trending repositories JSON from fixture file in chunks", async () => {
  const jsonContent = Deno.readTextFileSync("./tests/fixtures/github-trending.json");
  
  const chunkSize = 3 ;
  const chunks: string[] = [];
  
  for (let i = 0; i < jsonContent.length; i += chunkSize) {
    chunks.push(jsonContent.slice(i, i + chunkSize));
  }

  const entries: unknown[] = [];
  const stream = createStreamFromChunks(chunks);
  const parser = new StreamingJSONParser({
    onNewEntry: (entry) => {
      entries.push(entry);
    }
  });

  await parser.parseStream(stream);

  assertEquals(entries.length, 16); 
  
  // Verify first entry
  assertEquals(entries[0], {
    name: "google-gemini/cookbook",
    owner: "google-gemini",
    description: "Examples and guides for using the Gemini API",
    language: "Jupyter Notebook",
    stars: 7420,
    forks: 967,
    url: "https://github.com/google-gemini/cookbook",
    trending_position: 1
  });

  // Verify a middle entry
  assertEquals(entries[7], {
    name: "Radarr/Radarr",
    owner: "Radarr",
    description: "Movie organizer/manager for usenet and torrent users.",
    language: "C#",
    stars: 10517,
    forks: 1009,
    url: "https://github.com/Radarr/Radarr",
    trending_position: 8
  });

  // Verify last entry
  assertEquals(entries[15], {
    name: "LazyVim/LazyVim",
    owner: "LazyVim",
    description: "Neovim config for the lazy",
    language: "Lua",
    stars: 18088,
    forks: 1273,
    url: "https://github.com/LazyVim/LazyVim",
    trending_position: 16
  });
});
