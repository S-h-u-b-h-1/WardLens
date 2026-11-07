/**
 * WardLens browser-private scope check.
 * This is a conservative relevance filter, not a universal spam classifier.
 * A supported engine symptom wins; otherwise a first-hand, plausible civic
 * infrastructure concern can be saved as "needs clarification" without
 * inventing an incident. Unrelated statements cannot enter the report graph.
 */
const CIVIC_FEATURE=/(?:\b(?:water(?:\s+supply)?|tap(?:s)?|pump(?:ing)?|motor|electricity|electrical|power|blackout|transformer|road(?:s)?|street(?:s)?|sidewalk(?:s)?|footpath(?:s)?|pavement|drain(?:age)?|sewer(?:age)?|stormwater|gutter(?:s)?|street[\s-]?lights?|traffic[\s-]?lights?|traffic|crosswalk|potholes?|garbage|waste|rubbish|trash|public\s+toilet|public\s+transport|bus\s+stop|bridge|public\s+park|sanitation|street\s+sign|municipal|waterlogging)\b|नाली|नाला|सड़क|सड़क|गली|पानी|जलभराव|बिजली|पंप|कचरा|कूड़ा|सीवर|स्ट्रीट\s*लाइट|शौचालय|পানি|জল|রাস্তা|গলি|নর্দমা|ড্রেন|পাম্প|বিদ্যুৎ|আবর্জনা|বর্জ্য|পয়ঃনিষ্কাশন|বাতি|\b(?:naali|nala|nali|gali|sadak|sarak|paani|pani|bijli|kachra|kooda|kuda|sewage)\b)/iu;
const ISSUE=/(?:\b(?:broken|breakdown|not\s+working|not\s+functioning|stopped|failed|failure|outage|cut\s*off|interrupted|no\s+(?:water|electricity|power|supply)|blocked|clogged|choked|jammed|damaged|cracked|collapsed|potholes?|flood(?:ed|ing)?|waterlogg(?:ed|ing)|standing\s+water|overflow(?:ing)?|leak(?:s|ing|age)?|dripping|sparking|short\s+circuit|unsafe|dangerous|hazard|uncollected|piling\s+up|pile(?:d)?\s+up|not\s+collected|missing|stuck|stagnant|dirty|polluted|contaminated|flickering|no\s+longer\s+works|stalled|not\s+running)\b|बंद|खराब|टूटा|टूटी|फूटा|फूटी|भरा|भर\s+गया|जमा|नहीं\s+आ|रुका|रुकी|जाम|ब्लॉक|लीक|कूड़ा|टपक|गंदा|खतरा|काम\s+नहीं|বন্ধ|নষ্ট|ভাঙা|জমে|আটকে|জাম|পানি\s+নেই|জল\s+নেই|কাজ\s+করছে\s+না|ময়লা|\b(?:band|kharab|toot(?:a|i)|jam|ruk(?:a|i)|nahi|nahin|pani\s+(?:bhar|jama)|paani\s+(?:bhar|jama))\b)/iu;
const QUESTION=/^\s*(?:is|are|does|do|did|can|could|should|why|when|what|where|how|kya|क्या|কি)\b|[?؟？]\s*$/iu;
const HEARSAY=/(?:\b(?:maybe|perhaps|possibly|probably|i\s+heard|someone\s+said|rumou?r|i\s+think|shayad|mujhe\s+lagta)\b|शायद|सुना\s+है|मुझे\s+लगता|মনে\s+হয়|শুনেছি)/iu;
export function assessReportScope(statement,evidence){
 const text=String(statement??'').normalize('NFKC').replace(/\s+/g,' ').trim();
 if(!text || text.length<4)return {status:'out-of-scope',reason:'Describe a specific local public-infrastructure observation.'};
 if(Array.isArray(evidence?.symptoms)&&evidence.symptoms.length>0)
  return {status:'relevant',reason:'Supported first-hand civic observation.'};
 const civic=CIVIC_FEATURE.test(text),problem=ISSUE.test(text);
 if(civic&&problem){
  if(QUESTION.test(text)||HEARSAY.test(text))
   return {status:'clarify',reason:'Describe what you personally observed, rather than a question, rumour or guess.'};
  return {status:'needs-details',reason:'This may concern public infrastructure, but the evidence engine cannot classify it yet. Include the precise issue and what you directly observed.'};
 }
 return {status:'out-of-scope',reason:'WardLens accepts reports about public infrastructure, water, power, drainage, roads and local service problems—not food reviews, compliments, general conversations or unrelated topics.'};
}
