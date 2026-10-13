import {describe, expect, it} from "vitest";
import {levelOf, levelInfo, copyText} from "../src/core.js";

describe("core progression",()=>{
  it("calculates levels from XP",()=>{
    expect(levelOf(0).name).toBe("Network Rookie");
    expect(levelOf(300).name).toBe("Network Technician");
    expect(levelInfo(300).pct).toBe(0);
    expect(levelInfo(450).next).toBe(600);
  });
  it("falls back when Clipboard API is unavailable",async()=>{
    const original=navigator.clipboard;
    const exec=document.execCommand;
    navigator.clipboard=undefined;
    document.execCommand=()=>true;
    await expect(copyText("show ip route")).resolves.toBe(true);
    navigator.clipboard=original;
    document.execCommand=exec;
  });
  it("reports copy failure when both clipboard methods fail",async()=>{
    const original=navigator.clipboard;
    const exec=document.execCommand;
    navigator.clipboard=undefined;
    document.execCommand=()=>false;
    await expect(copyText("show ip route")).resolves.toBe(false);
    navigator.clipboard=original;
    document.execCommand=exec;
  });
});
