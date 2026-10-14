function answer({message,context:c}){
 const m=message.toLowerCase(), online=c.devices.filter(d=>d.status==="online").length, offline=c.devices.filter(d=>d.status==="offline");
 if(/health|healthy|status|sehat/.test(m)) return `Network health: ${online}/${c.devices.length} devices online, ${c.alerts} active alert(s), and ${c.links} link(s) currently up. ${offline.length?`Review ${offline.map(d=>d.name).join(", ")} first.`:"No offline device detected."}`;
 if(/topology|topologi|device|perangkat/.test(m)) return `I can see ${c.devices.length} device(s) in the current context: ${c.devices.map(d=>`${d.name} (${d.status})`).join(", ")||"no devices yet"}. Open Topology Builder to inspect links and interfaces.`;
 if(/trouble|problem|error|ping|down|gagal/.test(m)) return `Suggested troubleshooting path:\n1. Check physical/link status.\n2. Verify interface IP and mask.\n3. Check VLAN or gateway membership.\n4. Read the routing table.\n5. Test ping hop-by-hop.\n\nThis preview can explain simulator state, but it does not change devices automatically.`;
 if(/vlan/.test(m)) return `VLAN quick guide: access ports carry one VLAN, trunk ports carry multiple VLANs. Verify both switch sides use compatible trunk/native VLAN settings, then check the interface status in Network Inspector.`;
 if(/route|routing|ospf|static/.test(m)) return `Routing checklist: confirm interfaces are UP, networks are present in the routing process, neighbors reach FULL for OSPF, and the destination appears in the routing table.`;
 return `I’m the NETLAB Copilot preview. Ask me about network health, topology, troubleshooting, VLANs, or routing. I’m reading local simulator context only.`;
}
export {answer};
