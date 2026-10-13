import {describe, expect, it} from "vitest";
import {isIp, ip2n, n2ip, validMask, maskLen, netOf, sameNet} from "../src/sim/net.js";

describe("IP helpers",()=>{
  it("validates IPv4 addresses and rejects out-of-range octets",()=>{
    expect(isIp("192.168.1.1")).toBe(true);
    expect(isIp("0.0.0.0")).toBe(true);
    expect(isIp("256.1.1.1")).toBe(false);
    expect(isIp("192.168.1")).toBe(false);
  });
  it("round trips numeric IPv4 values",()=>{
    expect(n2ip(ip2n("203.0.113.7"))).toBe("203.0.113.7");
  });
  it("validates contiguous masks and calculates prefix length",()=>{
    expect(validMask("255.255.255.0")).toBe(true);
    expect(maskLen("255.255.255.0")).toBe(24);
    expect(validMask("255.0.255.0")).toBe(false);
    expect(validMask("0.0.0.0")).toBe(true);
    expect(maskLen("0.0.0.0")).toBe(0);
  });
  it("calculates networks",()=>{
    expect(netOf("192.168.1.77","255.255.255.0")).toBe("192.168.1.0");
    expect(sameNet("10.0.0.1","10.0.0.2","255.255.255.252")).toBe(true);
    expect(sameNet("10.0.0.1","10.0.0.5","255.255.255.252")).toBe(false);
  });
});
