// src/utils/logMatch.ts
function fileBaseOf(p) {
  const norm = (p || "").replace(/\\/g, "/");
  const idx = norm.lastIndexOf("/");
  return idx >= 0 ? norm.slice(idx + 1) : norm;
}
function funcMatch(candidateFn, parsedFn) {
  if (!candidateFn || !parsedFn) return false;
  const c = candidateFn.split(/::|->|\./).pop().toLowerCase();
  const p = parsedFn.toLowerCase();
  return c === p || c.includes(p) || p.includes(c);
}
var LOG_MACRO = /^(LOGE|LOGI|LOGW|LOGD|LOGC|LOG_PRINT|LOG_ERR|LOG_INFO|LOG_DEBUG|LOG_TRACE|printf|fprintf|console|NSLog|qDebug|qInfo|qWarning|android_print|TRACE|DEBUG_|INFO_|WARN_|ERROR_)$/i;
var CONTROL_FLOW = /^(if|for|while|switch|catch|return|throw|do|else|try|sizeof|typeof|new|delete)$/i;
function parseLogLine(rawLine) {
  const rawLower = rawLine.toLowerCase();
  let sourceLine;
  let fileBase;
  let funcName;
  let funcConf = "none";
  const bracketLine = rawLine.match(/(?<![A-Za-z0-9_])\[(\d{1,6})\]/);
  if (bracketLine) {
    sourceLine = parseInt(bracketLine[1], 10);
  }
  const lLine = rawLine.match(/\bL(\d{1,6})\b[:：]?/);
  if (lLine && sourceLine === void 0) {
    sourceLine = parseInt(lLine[1], 10);
  }
  const fileMatch = rawLine.match(/([A-Za-z_][\w.\-]*\.(?:cpp|cc|cs|hpp|hh|tsx|jsx|mm|go|py|java|ts|js|m|c|h))/);
  if (fileMatch) {
    fileBase = fileMatch[1];
  }
  const parenMatches = rawLine.match(/([A-Za-z_]\w*)\s*\(/g);
  if (parenMatches) {
    for (const pm of parenMatches) {
      const name = pm.replace(/\s*\($/, "");
      if (!LOG_MACRO.test(name) && !CONTROL_FLOW.test(name)) {
        funcName = name;
        funcConf = "high";
        break;
      }
    }
  }
  if (!funcName) {
    const dashMatch = rawLine.match(/([A-Za-z_]\w*)\s*-\s*\[/);
    if (dashMatch) {
      const name = dashMatch[1];
      if (!LOG_MACRO.test(name) && !CONTROL_FLOW.test(name)) {
        funcName = name;
        funcConf = "low";
      }
    }
  }
  if (!funcName) {
    const bracketFn = rawLine.match(/\[([A-Za-z_][a-z0-9_]*)\]/);
    if (bracketFn) {
      funcName = bracketFn[1];
      funcConf = "low";
    }
  }
  return { sourceLine, fileBase, funcName, funcConf, rawLower };
}
function getCandidateKeywords(c) {
  if (c.keywords && c.keywords.length > 0) return c.keywords;
  if (c.matchedText) {
    return c.matchedText.replace(/\s+/g, " ").trim().split(/\s+/).filter((k) => k.length > 0);
  }
  return [];
}
function bestByScore(cands, parsed) {
  let best = cands[0];
  let bestScore = -1;
  for (const c of cands) {
    let s = 0;
    if (parsed.fileBase && c.codeFile?.fileName && fileBaseOf(c.codeFile.fileName) === parsed.fileBase) s += 2;
    if (parsed.funcName && c.functionName && funcMatch(c.functionName, parsed.funcName)) s += 1;
    if (s > bestScore) {
      best = c;
      bestScore = s;
    }
  }
  return best;
}
function matchLogLineToCandidates(parsed, candidates) {
  if (parsed.sourceLine !== void 0) {
    const byLine = candidates.filter((c) => c.line === parsed.sourceLine);
    if (byLine.length > 0) {
      const matched2 = byLine.filter((c) => {
        const fileOk = !parsed.fileBase || !c.codeFile?.fileName || fileBaseOf(c.codeFile.fileName) === parsed.fileBase;
        const funcOk = parsed.funcConf !== "high" || !c.functionName || funcMatch(c.functionName, parsed.funcName);
        return fileOk && funcOk;
      });
      const pool = matched2.length > 0 ? matched2 : byLine;
      return bestByScore(pool, parsed);
    }
    return null;
  }
  const matched = candidates.filter((c) => {
    const kwList = getCandidateKeywords(c);
    if (kwList.length === 0) return false;
    return kwList.every((kw) => parsed.rawLower.includes(kw.toLowerCase()));
  });
  if (matched.length > 0) {
    let pool = matched;
    if (parsed.funcName) {
      const fm = matched.filter((c) => c.functionName && funcMatch(c.functionName, parsed.funcName));
      if (fm.length > 0) pool = fm;
    }
    return bestByScore(pool, parsed);
  }
  return null;
}
function parseModuleLogContent(content) {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.codeSearchResults)) return parsed.codeSearchResults;
  } catch (e) {
    console.error("Failed to parse module log content:", e);
  }
  return [];
}
function matchModuleAgainstLog(moduleLog, mainLogLines) {
  const candidates = parseModuleLogContent(moduleLog.content);
  if (candidates.length === 0) return [];
  const byCandidate = /* @__PURE__ */ new Map();
  mainLogLines.forEach((raw, idx) => {
    const parsed = parseLogLine(raw);
    const cand = matchLogLineToCandidates(parsed, candidates);
    if (cand) {
      if (!byCandidate.has(cand)) byCandidate.set(cand, []);
      byCandidate.get(cand).push({
        lineNumber: idx + 1,
        lineText: raw,
        codeText: cand.matchedText,
        codePath: cand.codeFile?.fileName,
        codeLine: cand.line,
        functionName: cand.functionName
      });
    }
  });
  return Array.from(byCandidate.entries()).map(([candidate, lines]) => ({ candidate, lines }));
}
export {
  matchLogLineToCandidates,
  matchModuleAgainstLog,
  parseLogLine,
  parseModuleLogContent
};
