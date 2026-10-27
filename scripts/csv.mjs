// CSV 流式解析：处理引号包裹、字段内换行、双引号转义（RFC4180）
import { createReadStream } from "node:fs";

export function parseCsv(path, onRecord) {
  return new Promise((resolve, reject) => {
    const stream = createReadStream(path, { encoding: "utf8" });
    let field = "";
    let record = [];
    let inQuotes = false;
    let pendingQuote = false;
    let header = null;
    let count = 0;

    const flushField = () => {
      record.push(field);
      field = "";
    };
    const flushRecord = () => {
      flushField();
      if (record.length === 1 && record[0] === "") {
        record = [];
        return;
      }
      if (!header) {
        header = record;
      } else {
        const obj = {};
        for (let i = 0; i < header.length; i++) obj[header[i]] = record[i] ?? "";
        count++;
        onRecord(obj);
      }
      record = [];
    };

    stream.on("data", (chunk) => {
      for (let i = 0; i < chunk.length; i++) {
        const ch = chunk[i];
        if (pendingQuote) {
          pendingQuote = false;
          if (ch === '"') {
            field += '"';
            continue;
          }
          inQuotes = false;
        }
        if (inQuotes) {
          if (ch === '"') pendingQuote = true;
          else field += ch;
          continue;
        }
        if (ch === '"') inQuotes = true;
        else if (ch === ",") flushField();
        else if (ch === "\n") flushRecord();
        else if (ch === "\r") {
          /* skip */
        } else field += ch;
      }
    });
    stream.on("end", () => {
      if (field !== "" || record.length) flushRecord();
      resolve(count);
    });
    stream.on("error", reject);
  });
}
