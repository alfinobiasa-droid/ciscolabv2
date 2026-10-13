import {beforeEach, describe, expect, it} from "vitest";
import {buildTemplate, exportProject, importProject, NET, pingNet, routing} from "../src/sim/network.js";

describe("network simulator",()=>{
  beforeEach(()=>{NET.devs=[];NET.links=[];NET.nid=1;NET.tl=[];NET.gen=null});
  it("builds the static-route template and reaches both LANs",()=>{
    expect(buildTemplate("dua-lan")).toBe(true);
    const [pc1,pc2]=NET.devs.filter(d=>d.type==="pc");
    expect(pingNet(pc1,pc2.o.ifs.eth0.ip).ok).toBe(true);
  });
  it("builds OSPF template with dynamic neighbors",()=>{
    expect(buildTemplate("ospf-3")).toBe(true);
    routing();
    expect(NET.devs.filter(d=>d.type==="router").every(d=>d.nbr.ospf.length>0)).toBe(true);
  });
  it("round trips exported projects",()=>{
    buildTemplate("nat-pat");
    const result=importProject(JSON.stringify(exportProject()));
    expect(result.ok).toBe(true);
    expect(result.devs).toHaveLength(NET.devs.length);
    expect(result.links).toHaveLength(NET.links.length);
  });
  it("rejects invalid project schema and dangerous keys",()=>{
    expect(importProject("not json").ok).toBe(false);
    expect(importProject(JSON.stringify({schema:"wrong",version:1,devices:[],links:[]})).ok).toBe(false);
    const bad='{"schema":"netlab-topology","version":1,"devices":[],"links":[],"__proto__":{"polluted":true}}';
    expect(importProject(bad).ok).toBe(false);
    expect(importProject('{"schema":"netlab-topology","version":1,"devices":[],"links":[],"constructor":{}}').ok).toBe(false);
  });
});
