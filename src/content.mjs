const fields = ['schemaVersion','issue','title','titleEmphasis','introduction','introductionEmphasis','points','reminder','reviewStatus','portrait'];
export function validateContent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('文案必须为 JSON 对象');
  for (const key of Object.keys(value)) if (!fields.includes(key)) throw Error(`未知文案字段：${key}`);
  if (value.schemaVersion !== 1) throw Error('schemaVersion 必须为 1');
  if (!Number.isSafeInteger(value.issue) || value.issue < 0 || value.issue > 999999) throw Error('issue 必须为 0–999999 的整数；0仅用于工程样张');
  for (const key of ['title','introduction','reminder']) if (typeof value[key] !== 'string' || !value[key].trim()) throw Error(`缺少 ${key}`);
  if (!['draft','pending_review','approved','rejected','not_applicable'].includes(value.reviewStatus)) throw Error('缺少有效 reviewStatus；仅照录人工审核记录');
  if (!Array.isArray(value.points) || ![3,4].includes(value.points.length)) throw Error('知识点必须为3或4条，不自动凑数');
  for (const [i,p] of value.points.entries()) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw Error(`知识点${i+1}必须为对象`);
    for (const k of Object.keys(p)) if (!['heading','body','iconId','iconSemantic'].includes(k)) throw Error(`知识点${i+1}未知字段：${k}`);
    for (const k of ['heading','body']) if (typeof p[k] !== 'string' || !p[k].trim()) throw Error(`知识点${i+1}缺少${k}`);
    if (!p.iconId && !p.iconSemantic) throw Error(`知识点${i+1}需提供iconId或iconSemantic`);
  }
  for (const [field,target] of [['titleEmphasis','title'],['introductionEmphasis','introduction']]) {
    if (value[field] === undefined) continue;
    if (!Array.isArray(value[field]) || value[field].some(s => typeof s !== 'string' || !s || !value[target].includes(s))) throw Error(`${field}必须为原文中存在的非空短语数组`);
    const used=[];
    for (const phrase of value[field]) { const start=value[target].indexOf(phrase),end=start+phrase.length;if(used.some(([a,b])=>start<b&&end>a))throw Error(`${field}短语不能重叠`);used.push([start,end]); }
  }
  if (value.portrait !== undefined) {
    if (!value.portrait || typeof value.portrait !== 'object' || Array.isArray(value.portrait)) throw Error('portrait须为对象');
    for(const k of Object.keys(value.portrait))if(!['file','positionX','positionY'].includes(k))throw Error(`portrait未知字段${k}`);
    if(typeof value.portrait.file!=='string'||!value.portrait.file)throw Error('portrait.file必填');
    for(const k of ['positionX','positionY'])if(value.portrait[k]!==undefined&&(!Number.isFinite(value.portrait[k])||value.portrait[k]<0||value.portrait[k]>100))throw Error(`${k}须为0–100`);
  }
  return value;
}
export function resolveIcons(points, registry) {
  return points.map((p,i) => {
    if(p.iconId){if(!Object.hasOwn(registry,p.iconId))throw Error(`知识点${i+1}未知iconId：${p.iconId}`);return {id:p.iconId,...registry[p.iconId],reason:'explicit'};}
    const match=Object.entries(registry).find(([,v])=>(v.semantics||[]).includes(p.iconSemantic));
    const [id,entry]=match || ['general-info',registry['general-info']];
    return {id,...entry,reason:match?'semantic':`未登记语义“${p.iconSemantic}”，使用通用信息符号`};
  });
}
