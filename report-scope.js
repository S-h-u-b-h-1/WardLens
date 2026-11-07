/**
 * WardLens browser-private scope check.
 * This is a conservative relevance filter, not a universal spam classifier.
 * A supported engine symptom wins; otherwise a first-hand, plausible civic
 * infrastructure concern can be saved as "needs clarification" without
 * inventing an incident. Unrelated statements cannot enter the report graph.
 */
const CIVIC_FEATURE=/(?:\b(?:water(?:\s+supply)?|tap(?:s)?|pump(?:ing)?|motor|electricity|electrical|power|blackout|transformer|road(?:s)?|street(?:s)?|sidewalk(?:s)?|footpath(?:s)?|pavement|drain(?:age)?|sewer(?:age)?|stormwater|gutter(?:s)?|street[\s-]?lights?|traffic[\s-]?lights?|traffic|crosswalk|potholes?|garbage|waste|rubbish|trash|public\s+toilet|public\s+transport|bus\s+stop|bridge|public\s+park|sanitation|street\s+sign|municipal|waterlogging)\b|नाली|नाला|सड़क|सड़क|गली|पानी|जलभराव|बिजली|पंप|कचरा|कूड़ा|सीवर|स्ट्रीट\s*लाइट|शौचालय|পানি|জল|রাস্তা|গলি|নর্দমা|ড্রেন|পাম্প|বিদ্যুৎ|আবর্জনা|বর্জ্য|পয়ঃনিষ্কাশন|বাতি|\b(?:naali|nala|nali|gali|sadak|sarak|paani|pani|bijli|kachra|kooda|kuda|sewage)\b)/iu;
const ISSUE=/(?:\b(?:broken|breakdown|not\s+working|not\s+functioning|stopped|failed|failure|outage|cut\s*off|interrupted|no\s+(?:water|electricity|power|supply)|blocked|clog���q�^