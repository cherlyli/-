import React, { useState, useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Car, MapPin, Navigation, Sparkles, Loader2, Compass, Mountain, Gem, Palette, Search, Plus, ChevronRight, X, ArrowRight, Clock, Coins,  Hotel, Utensils, Camera, Calendar, CloudSun, Heart } from "lucide-react";
import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini AI
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Types & Interfaces ---
interface Coordinates {
  lat: number;
  lng: number;
}

type CategoryType = "heritage" | "origin" | "geo" | "craft";

// Basic static data
interface CityData {
  id: string;
  name: string;
  category: CategoryType;
  coordinates: Coordinates;
  specialtyTitle: string;
  specialtyDescription: string;
  distanceFromShanghaiKm: number;
  driveTimeHours: number;
  tollCostCNY: number;
  selfDrivingFriendly: boolean;
  tags: string[];
}

// Dynamic AI data
interface AIDeepDiveData {
  hotelInfo?: {
    hasIHG: boolean;
    ihgName?: string;
    ihgPetFriendly: boolean;
    alternativePetHotel?: string;
  };
  food?: string[];
  mustVisit?: string[];
  culture?: {
    name?: string;
    description?: string;
    timing?: string;
    isVisibleNow?: boolean;
  };
  seasonality?: {
    currentVibe?: string; // e.g., "Silver Gingko leaves" or "Snowing"
    verdict?: string; // "Highly Recommended" etc.
  };
}

const SHANGHAI_COORDS: Coordinates = { lat: 31.2304, lng: 121.4737 };

// --- Compressed Data Helper ---
const createCity = (
  id: string, name: string, lat: number, lng: number, cat: CategoryType, 
  title: string, desc: string, dist: number, time: number, toll: number, friendly: boolean, tags: string[]
): CityData => ({
  id, name, category: cat, coordinates: { lat, lng }, specialtyTitle: title, specialtyDescription: desc,
  distanceFromShanghaiKm: dist, driveTimeHours: time, tollCostCNY: toll, selfDrivingFriendly: friendly, tags
});

// --- Expanded Seed Data ---
const INITIAL_CITIES: CityData[] = [
  createCity("cicheng", "宁波慈城", 29.985, 121.448, "heritage", "非遗手工艺古镇", "螺钿镶嵌、木雕、刺绣聚集地。", 210, 3, 100, true, ["螺钿", "木雕"]),
  createCity("kaili", "贵州凯里", 26.583, 107.977, "heritage", "苗族非遗之都", "苗族亮布、蜡染、银饰的中心。", 1700, 19, 900, false, ["蜡染", "银饰"]),
  createCity("suzhou", "苏州", 31.298, 120.585, "heritage", "苏绣与园林", "苏绣发源地，拥有精湛的丝绸技艺。", 100, 1.5, 45, true, ["苏绣", "丝绸"]),
  createCity("nanjing", "南京", 32.060, 118.796, "heritage", "云锦织造", "寸锦寸金的云锦工艺，皇室御用。", 300, 3.5, 135, true, ["云锦", "历史"]),
  createCity("yangzhou", "扬州", 32.394, 119.412, "heritage", "漆器与玉雕", "扬州漆器工艺精湛，玉雕工巧。", 280, 3.2, 120, true, ["漆器", "玉雕"]),
  createCity("weifang", "山东潍坊", 36.707, 119.161, "heritage", "风筝之都", "世界风筝发源地，木版年画亦出名。", 850, 9.5, 400, false, ["风筝", "年画"]),
  createCity("quanzhou", "福建泉州", 24.874, 118.675, "heritage", "海上丝路起点", "提线木偶戏，南音，花灯。", 980, 11, 480, false, ["木偶戏", "南音"]),
  createCity("huizhou", "安徽黄山", 29.714, 118.337, "heritage", "徽州三雕", "木雕、石雕、砖雕工艺的巅峰。", 400, 4.5, 190, true, ["徽雕", "墨"]),
  createCity("foshan", "广东佛山", 23.021, 113.121, "heritage", "醒狮与武术", "南狮发源地，功夫之城。", 1500, 17, 750, false, ["醒狮", "陶瓷"]),
  createCity("chengdu", "四川成都", 30.572, 104.066, "heritage", "蜀锦与漆器", "四大名锦之一蜀锦，成都漆艺。", 1950, 22, 1000, false, ["蜀锦", "竹编"]),
  createCity("zhuji", "绍兴诸暨", 29.718, 120.236, "origin", "华东国际珠宝城", "最大淡水珍珠市场，开蚌体验。", 180, 2.5, 85, true, ["珍珠"]),
  createCity("baoshan", "云南保山", 25.112, 99.162, "origin", "南红玛瑙之都", "顶级南红原产地，宝石猎人必去。", 2650, 30, 1400, false, ["南红", "宝石"]),
  createCity("hotan", "新疆和田", 37.114, 79.922, "origin", "和田玉源头", "羊脂白玉的原产地，玉龙喀什河。", 4200, 48, 2000, false, ["和田玉"]),
  createCity("wuyishan", "福建武夷山", 27.755, 118.035, "origin", "大红袍祖庭", "岩茶核心产区，茶文化深厚。", 700, 8, 350, false, ["茶叶", "岩茶"]),
  createCity("donghai", "江苏东海", 34.542, 118.763, "origin", "世界水晶之都", "天然水晶储量与交易量极大。", 500, 5.5, 230, true, ["水晶"]),
  createCity("qimen", "安徽祁门", 29.855, 117.717, "origin", "红茶皇后", "祁门红茶原产地，香气高扬。", 450, 5, 210, true, ["红茶"]),
  createCity("maotai", "贵州茅台镇", 27.854, 106.381, "origin", "酱香酒魂", "国酒茅台产地，酒香弥漫全镇。", 1800, 20, 950, false, ["白酒"]),
  createCity("fuzhou_jx", "江西抚州", 27.947, 116.357, "origin", "南丰蜜桔", "中国蜜桔之乡，不仅有桔还有才子文化。", 700, 8, 320, false, ["蜜桔"]),
  createCity("ruili", "云南瑞丽", 24.012, 97.851, "origin", "翡翠集散地", "中缅边境最大的翡翠交易市场。", 2800, 32, 1500, false, ["翡翠"]),
  createCity("shouguang", "山东寿光", 36.881, 118.736, "origin", "蔬菜之都", "中国蔬菜博览会，现代农业奇观。", 800, 9, 380, false, ["农业"]),
  createCity("qinghaihu", "青海湖", 36.620, 100.220, "geo", "高原蓝宝石", "最大咸水湖与盐湖，天空之镜。", 2300, 26, 1100, false, ["盐湖", "高原"]),
  createCity("zhangye", "甘肃张掖", 38.925, 100.449, "geo", "七彩丹霞", "上帝打翻的调色盘，丹霞地貌。", 2500, 28, 1250, false, ["丹霞"]),
  createCity("songyang", "浙江松阳", 28.450, 119.480, "geo", "江南最后的秘境", "山地古村落，云雾缭绕。", 400, 5, 190, true, ["古村", "秘境"]),
  createCity("changbaishan", "吉林长白山", 42.006, 128.057, "geo", "天池圣境", "休眠火山，高山湖泊，原始森林。", 1800, 20, 850, false, ["火山", "天池"]),
  createCity("guilin", "广西桂林", 25.273, 110.290, "geo", "喀斯特山水", "漓江山水甲天下，独特岩溶地貌。", 1500, 16, 700, false, ["喀斯特", "山水"]),
  createCity("huanglong", "四川黄龙", 32.753, 103.823, "geo", "钙化彩池", "人间瑶池，五彩斑斓的钙化池。", 2100, 24, 1100, false, ["钙化池", "雪山"]),
  createCity("panjin", "辽宁盘锦", 41.134, 122.067, "geo", "红海滩", "碱蓬草编织的红色海岸线。", 1600, 17, 750, false, ["湿地", "红海滩"]),
  createCity("ench", "湖北恩施", 30.295, 109.479, "geo", "大峡谷", "媲美科罗拉多的大峡谷，绝壁栈道。", 1100, 13, 550, false, ["峡谷"]),
  createCity("wuyuan", "江西婺源", 29.283, 117.861, "geo", "最美乡村", "梯田油菜花，徽派建筑与自然的融合。", 480, 5.5, 230, true, ["梯田", "花海"]),
  createCity("dunhuang", "甘肃敦煌", 40.142, 94.661, "geo", "鸣沙山月牙泉", "沙漠与清泉共存的奇迹。", 2800, 31, 1400, false, ["沙漠", "绿洲"]),
  createCity("jingdezhen", "江西景德镇", 29.293, 117.207, "craft", "千年瓷都", "世界陶瓷中心，市集文化活跃。", 450, 5.5, 220, true, ["陶瓷"]),
  createCity("yixing", "无锡宜兴", 31.362, 119.822, "craft", "紫砂壶之都", "紫砂唯一原产地，大师云集。", 160, 2, 75, true, ["紫砂"]),
  createCity("longquan", "浙江龙泉", 28.073, 119.141, "craft", "青瓷与宝剑", "龙泉青瓷温润如玉，宝剑锋利。", 480, 5.5, 225, true, ["青瓷", "宝剑"]),
  createCity("dehua", "福建德化", 25.492, 118.243, "craft", "中国白", "德化白瓷，如脂似玉，雕塑精美。", 850, 10, 420, false, ["白瓷"]),
  createCity("nantong", "江苏南通", 32.008, 120.894, "craft", "蓝印花布", "传统染织技艺，朴素大方。", 120, 1.5, 50, true, ["印染"]),
  createCity("pingyao", "山西平遥", 37.189, 112.176, "craft", "推光漆器", "中国四大漆器之一，手掌推光。", 1100, 12, 550, false, ["漆器", "古城"]),
  createCity("liuyang", "湖南浏阳", 28.140, 113.626, "craft", "花炮之乡", "全球最大的烟花生产基地。", 1100, 12, 540, false, ["烟花"]),
  createCity("zigong", "四川自贡", 29.339, 104.778, "craft", "彩灯与井盐", "天下第一灯，千年盐都。", 1850, 21, 920, false, ["彩灯", "井盐"]),
  createCity("shantou", "广东汕头", 23.366, 116.682, "craft", "潮绣与抽纱", "绣工精细，富丽堂皇。", 1350, 15, 650, false, ["潮绣"]),
  createCity("tengchong", "云南腾冲", 25.025, 98.490, "craft", "琥珀与翡翠", "著名的翡翠加工集散地，皮影戏。", 2750, 31, 1450, false, ["琥珀", "皮影"]),
];

// --- Helper Functions ---
const getCategoryConfig = (cat: CategoryType) => {
  switch(cat) {
    case 'heritage': return { label: '非遗', color: '#a855f7', bg: 'bg-purple-100', text: 'text-purple-700', icon: <Palette size={14}/> };
    case 'origin': return { label: '原产', color: '#f59e0b', bg: 'bg-orange-100', text: 'text-orange-700', icon: <Gem size={14}/> };
    case 'geo': return { label: '风光', color: '#10b981', bg: 'bg-emerald-100', text: 'text-emerald-700', icon: <Mountain size={14}/> };
    case 'craft': return { label: '工艺', color: '#3b82f6', bg: 'bg-blue-100', text: 'text-blue-700', icon: <Sparkles size={14}/> };
    default: return { label: '地点', color: '#6b7280', bg: 'bg-gray-100', text: 'text-gray-700', icon: <MapPin size={14}/> };
  }
};

// --- Custom Icons (Colored Bubbles with Glowing Edges) ---
const createCustomIcon = (city: CityData, isSelected: boolean) => {
  const config = getCategoryConfig(city.category);
  const dotSize = isSelected ? 24 : 16;
  
  return L.divIcon({
    className: "custom-map-marker",
    html: `
      <div style="position: relative; width: 0; height: 0;">
        <!-- The Dot (Center) -->
        <div style="
          position: absolute;
          left: 0;
          top: 0;
          transform: translate(-50%, -50%);
          width: ${dotSize}px; 
          height: ${dotSize}px; 
          background-color: ${config.color}; 
          border: 3px solid #ffffff; 
          border-radius: 50%; 
          box-shadow: 0 0 15px ${config.color}; 
          z-index: 20;
          cursor: pointer;
          transition: all 0.3s ease;
        "></div>
        
        <!-- The Floating Label (Glowing Bubble) -->
        <div style="
          position: absolute;
          left: ${dotSize/2 + 10}px;
          top: 0;
          transform: translateY(-50%);
          padding: 10px 14px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid ${config.color}60;
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.15),
            0 0 15px ${config.color}30, 
            inset 0 0 15px ${config.color}15;
          display: flex;
          flex-direction: column;
          gap: 3px;
          white-space: nowrap;
          z-index: 10;
          cursor: pointer;
          min-width: max-content;
        ">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: #1a1a1a; font-size: 13px; font-weight: 800; letter-spacing: -0.01em;">${city.name || '未知地点'}</span>
            <span style="width: 3px; height: 3px; border-radius: 50%; background-color: #d1d5db;"></span>
            <span style="color: ${config.color}; font-size: 11px; font-weight: 600; max-width: 140px; truncate">${city.specialtyTitle || ''}</span>
          </div>
          
          <div style="color: #6b7280; font-size: 10px; font-weight: 500; display: flex; align-items: center; gap: 6px; margin-top: 1px;">
             <span>${city.distanceFromShanghaiKm} km</span>
             <span style="width: 1px; height: 8px; background-color: #e5e7eb;"></span>
             <span>${city.driveTimeHours} h</span>
          </div>
        </div>
      </div>
    `,
    iconSize: [0, 0], 
    iconAnchor: [0, 0], 
  });
};

const ShanghaiIcon = L.divIcon({
  className: "shanghai-marker",
  html: `<div style="
    position: absolute;
    transform: translate(-50%, -50%);
    background: #10b981; 
    color: #ffffff; 
    padding: 8px 16px; 
    border-radius: 99px; 
    font-weight: 800; 
    font-size: 13px; 
    box-shadow: 0 4px 20px rgba(16, 185, 129, 0.6); 
    display: flex; 
    align-items: center; 
    justify-content: center;
    gap: 6px;
    white-space: nowrap;
    border: 1px solid rgba(255,255,255,0.9);
    width: max-content;
  ">
    <span>上海</span>
    <span style="font-size: 16px; line-height: 1;">🌞</span>
    <span>(出发地)</span>
  </div>`,
  iconSize: [0, 0],
});

const MapUpdater = ({ center, zoom }: { center: Coordinates; zoom: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom, { animate: true, duration: 1.2, easeLinearity: 0.25 });
  }, [center, zoom, map]);
  return null;
};

// --- Main App Component ---
const App = () => {
  const [cities, setCities] = useState<CityData[]>(INITIAL_CITIES);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [promptInput, setPromptInput] = useState("");
  
  // New state for AI Details
  const [deepDiveData, setDeepDiveData] = useState<AIDeepDiveData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Favorites State
  const [savedCityIds, setSavedCityIds] = useState<Set<string>>(new Set());
  const [isFavOpen, setIsFavOpen] = useState(false);

  const selectedCity = useMemo(() => cities.find((c) => c.id === selectedCityId) || null, [cities, selectedCityId]);

  // Effect: When city is selected, fetch deep dive info
  useEffect(() => {
    if (selectedCity) {
      fetchDeepDive(selectedCity.name);
    } else {
      setDeepDiveData(null);
    }
  }, [selectedCity]);

  const toggleSaveCity = (id: string) => {
    const next = new Set(savedCityIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSavedCityIds(next);
  };

  const fetchDeepDive = async (cityName: string) => {
    setDetailLoading(true);
    setDeepDiveData(null);
    try {
      const model = "gemini-3-flash-preview";
      // Get current date for seasonality
      const now = new Date();
      const month = now.getMonth() + 1;
      
      const prompt = `
        为 ${cityName} (中国) 生成本月(${month}月)的旅行深度分析。
        请返回 JSON 格式，严格只使用中文回答:
        1. hotelInfo: 检查是否有 IHG 旗下酒店。如果有，是否宠物友好？如果没有 IHG，推荐另一家具体的宠物友好酒店（名字及特点）。
        2. food: 列出 3 道具体的当地特色菜名。
        3. mustVisit: 列出 3 个最值得拍照打卡的具体景点名称。
        4. culture: 一个具体的民俗活动（如英歌舞、鱼灯、庙会等），它的典型举办时间，以及本月是否可见。
        5. seasonality: 分析现在是否是旅行的好时机（例如 11月看银杏，12月看雪）。给出简短的判定（如“强烈推荐”、“一般推荐”、“季节不对”），并给出一段简短的氛围描述。
      `;

      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              hotelInfo: {
                type: Type.OBJECT,
                properties: {
                  hasIHG: { type: Type.BOOLEAN },
                  ihgName: { type: Type.STRING },
                  ihgPetFriendly: { type: Type.BOOLEAN },
                  alternativePetHotel: { type: Type.STRING },
                }
              },
              food: { type: Type.ARRAY, items: { type: Type.STRING } },
              mustVisit: { type: Type.ARRAY, items: { type: Type.STRING } },
              culture: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  timing: { type: Type.STRING },
                  isVisibleNow: { type: Type.BOOLEAN },
                }
              },
              seasonality: {
                type: Type.OBJECT,
                properties: {
                  currentVibe: { type: Type.STRING },
                  verdict: { type: Type.STRING },
                }
              }
            }
          }
        }
      });
      
      const result = JSON.parse(response.text);
      setDeepDiveData(result);
    } catch (error) {
      console.error("Deep dive failed", error);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleExploreMore = async () => {
    setLoading(true);
    try {
      const model = "gemini-3-flash-preview";
      const existingNames = cities.map(c => c.name);
      
      const response = await ai.models.generateContent({
        model: model,
        contents: `生成 4 个不在列表中的中国独特旅行地点（非遗、原产地、风光或工艺）。排除: ${existingNames.join(", ")}。返回 JSON，所有内容必须是中文。`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              locations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    category: { type: Type.STRING, enum: ["heritage", "origin", "geo", "craft"] },
                    coordinates: { type: Type.OBJECT, properties: { lat: { type: Type.NUMBER }, lng: { type: Type.NUMBER } } },
                    specialtyTitle: { type: Type.STRING },
                    specialtyDescription: { type: Type.STRING },
                    distanceFromShanghaiKm: { type: Type.NUMBER },
                    driveTimeHours: { type: Type.NUMBER },
                    tollCostCNY: { type: Type.NUMBER },
                    selfDrivingFriendly: { type: Type.BOOLEAN },
                    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                  }
                }
              }
            }
          }
        }
      });

      const data = JSON.parse(response.text);
      if (data.locations) {
        const newItems = data.locations
          .filter((loc: any) => loc && loc.name && loc.coordinates)
          .map((loc: any, i: number) => ({
            ...loc,
            id: `ai-${Date.now()}-${i}`,
        }));
        setCities(prev => [...prev, ...newItems]);
      }
    } catch (e) {
      console.error(e);
      alert("AI 连接繁忙，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!promptInput.trim()) return;
    setLoading(true);
    try {
       const model = "gemini-3-flash-preview";
       const response = await ai.models.generateContent({
         model,
         contents: `推荐 3 个适合 "${promptInput}" 的中国旅行地点。排除现有地点。返回 JSON，所有内容必须是中文。`,
         config: {
           responseMimeType: "application/json",
           responseSchema: {
             type: Type.OBJECT,
             properties: {
               locations: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
                 name: { type: Type.STRING },
                 category: { type: Type.STRING, enum: ["heritage", "origin", "geo", "craft"] },
                 coordinates: { type: Type.OBJECT, properties: { lat: { type: Type.NUMBER }, lng: { type: Type.NUMBER } } },
                 specialtyTitle: { type: Type.STRING },
                 specialtyDescription: { type: Type.STRING },
                 distanceFromShanghaiKm: { type: Type.NUMBER },
                 driveTimeHours: { type: Type.NUMBER },
                 tollCostCNY: { type: Type.NUMBER },
                 selfDrivingFriendly: { type: Type.BOOLEAN },
                 tags: { type: Type.ARRAY, items: { type: Type.STRING } },
               } } }
             }
           }
         }
       });
       const data = JSON.parse(response.text);
       if(data.locations) {
         const newItems = data.locations
           .filter((loc: any) => loc && loc.name && loc.coordinates)
           .map((loc: any, i: number) => ({ ...loc, id: `search-${Date.now()}-${i}` }));
         setCities(prev => [...newItems, ...prev]);
         if (newItems.length > 0) setSelectedCityId(newItems[0].id);
       }
    } catch(e) { console.error(e); }
    setLoading(false);
    setPromptInput("");
  };

  return (
    <div className="flex h-screen w-full bg-black text-white font-sans overflow-hidden">
      
      {/* Sidebar - Dark Aesthetic */}
      <div className="flex-shrink-0 w-full md:w-[420px] h-full bg-black relative z-30 flex flex-col border-r border-white/10">
        
        <div className="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-[#103020] via-black to-black opacity-60 pointer-events-none z-0"></div>

        {/* Header */}
        <div className="pt-8 pb-6 px-6 z-10">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold tracking-tighter text-white">
              CHINA <br/>
              <span className="text-emerald-500">EXPLORER</span>
            </h1>
            <div className="bg-white/10 p-2 rounded-full backdrop-blur-md">
               <Compass size={24} className="text-white" />
            </div>
          </div>
          
          <p className="text-white/60 text-sm mb-6 leading-relaxed">
            探索中国非遗、原产地与极致风光。<br/>
            上海出发 · 自驾指南 · 时令决策
          </p>

          {/* Search Input */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-white/40" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-10 py-3 border border-white/10 rounded-xl bg-white/5 text-white placeholder-white/30 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-sm backdrop-blur-sm"
              placeholder="搜索：丝绸、茶山、古镇..."
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            {loading && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
              </div>
            )}
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-20 space-y-4 custom-scrollbar z-10">
          {cities.map((city) => {
            const config = getCategoryConfig(city.category);
            const isSelected = selectedCityId === city.id;
            
            return (
              <div
                key={city.id}
                onClick={() => setSelectedCityId(city.id)}
                style={isSelected ? {
                  background: 'rgba(255, 255, 255, 0.95)',
                  boxShadow: `0 8px 30px -5px rgba(0,0,0,0.3), 0 0 20px ${config.color}50, inset 0 0 0 1px ${config.color}80`,
                  backdropFilter: 'blur(10px)',
                  transform: 'scale(1.02)'
                } : {}}
                className={`
                  relative p-5 rounded-[20px] cursor-pointer transition-all duration-300 group
                  ${isSelected 
                    ? "z-10" 
                    : "bg-white hover:scale-[1.01] hover:shadow-[0_0_15px_rgba(255,255,255,0.15)]"
                  }
                `}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-[18px] font-bold leading-tight text-black">
                    {city.name}
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${city.selfDrivingFriendly ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                    {city.selfDrivingFriendly ? '自驾友好' : '建议长途'}
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded ${config.bg} ${config.text}`}>
                     {config.icon} {config.label}
                  </span>
                  <span className="text-[13px] font-medium text-gray-600 truncate">{city.specialtyTitle}</span>
                </div>

                <p className="text-[13px] text-gray-500 line-clamp-2 leading-relaxed mb-4 font-normal">
                  {city.specialtyDescription}
                </p>

                <div className="grid grid-cols-3 gap-2 border-t border-gray-100 pt-3">
                   <div className="flex flex-col">
                      <span className="text-[9px] text-gray-400 font-bold tracking-wider uppercase">距离</span>
                      <span className="text-[14px] font-bold text-black">{city.distanceFromShanghaiKm}<span className="text-[10px] text-gray-400 font-normal ml-0.5">km</span></span>
                   </div>
                   <div className="flex flex-col border-l border-gray-100 pl-3">
                      <span className="text-[9px] text-gray-400 font-bold tracking-wider uppercase">路费</span>
                      <span className="text-[14px] font-bold text-black">¥{city.tollCostCNY}</span>
                   </div>
                   <div className="flex flex-col border-l border-gray-100 pl-3">
                      <span className="text-[9px] text-gray-400 font-bold tracking-wider uppercase">车程</span>
                      <span className="text-[14px] font-bold text-black">{city.driveTimeHours}<span className="text-[10px] text-gray-400 font-normal ml-0.5">h</span></span>
                   </div>
                </div>
                
                {isSelected && (
                    <div className="absolute right-4 bottom-4">
                        <ArrowRight size={16} className="text-black" />
                    </div>
                )}
              </div>
            );
          })}

          <button 
            onClick={() => handleExploreMore()} 
            disabled={loading}
            className="w-full py-4 mt-6 rounded-[20px] border border-white/20 text-white/60 text-sm font-medium hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2 backdrop-blur-md"
          >
            {loading ? <Loader2 size={16} className="animate-spin"/> : <Plus size={16}/>}
            加载更多地点
          </button>
          
          <div className="h-8"></div>
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative h-full bg-[#050505]">
        <MapContainer
          center={[34.0, 108.0]}
          zoom={5}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
          className="z-0"
        >
          {/* Dark Mode Map Tiles via CSS Invert */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            className="map-tiles-dark"
          />
          <style>{`
            .map-tiles-dark {
              filter: invert(100%) hue-rotate(180deg) brightness(70%) contrast(90%) grayscale(20%);
            }
          `}</style>
          
          <div className="absolute top-6 right-6 z-[400] flex flex-col gap-3">
            {/* Favorites Toggle */}
            <button 
              className="bg-black/80 backdrop-blur-xl p-3 rounded-full border border-white/20 text-white hover:bg-white hover:text-black transition-all relative"
              onClick={() => setIsFavOpen(true)}
            >
              <Heart size={20} className={savedCityIds.size > 0 ? "text-red-500 fill-red-500" : ""} />
              {savedCityIds.size > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                  {savedCityIds.size}
                </span>
              )}
            </button>
            
            {/* Reset Map View */}
            <button 
              className="bg-black/80 backdrop-blur-xl p-3 rounded-full border border-white/20 text-white hover:bg-white hover:text-black transition-all"
              onClick={() => setSelectedCityId(null)}
            >
              <Navigation size={20} />
            </button>
          </div>

          <Marker position={[SHANGHAI_COORDS.lat, SHANGHAI_COORDS.lng]} icon={ShanghaiIcon} zIndexOffset={9999} />

          {cities.map((city) => {
             const isSelected = selectedCityId === city.id;
             // getCategoryConfig is called inside createCustomIcon for colors
             return (
              <React.Fragment key={city.id}>
                <Marker 
                  position={[city.coordinates.lat, city.coordinates.lng]}
                  icon={createCustomIcon(city, isSelected)}
                  eventHandlers={{
                    click: () => {
                      setSelectedCityId(city.id);
                    },
                  }}
                  zIndexOffset={isSelected ? 1000 : 0}
                >
                </Marker>

                {isSelected && (
                  <Polyline 
                    positions={[
                      [SHANGHAI_COORDS.lat, SHANGHAI_COORDS.lng],
                      [city.coordinates.lat, city.coordinates.lng]
                    ]}
                    pathOptions={{ 
                      color: city.selfDrivingFriendly ? '#34d399' : '#fbbf24', 
                      weight: 3, 
                      dashArray: '1, 8', 
                      opacity: 0.8,
                      lineCap: 'round'
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}

          {selectedCity && (
            <MapUpdater center={selectedCity.coordinates} zoom={8} />
          )}
        </MapContainer>

        {/* Favorites Modal */}
        {isFavOpen && (
          <div className="absolute inset-0 z-[600] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
               <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white z-10">
                   <div className="flex items-center gap-2">
                       <Heart className="text-red-500 fill-red-500" size={20}/>
                       <h2 className="text-xl font-bold text-black">收藏中心</h2>
                   </div>
                   <button onClick={() => setIsFavOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                       <X className="text-gray-400" size={20}/>
                   </button>
               </div>
               
               <div className="overflow-y-auto p-4 space-y-3 custom-scrollbar">
                   {savedCityIds.size === 0 ? (
                       <div className="flex flex-col items-center justify-center py-12 text-center">
                           <div className="bg-gray-50 p-4 rounded-full mb-3">
                               <Heart size={32} className="text-gray-300"/>
                           </div>
                           <p className="text-gray-400 text-sm">暂无收藏地点<br/>去地图上探索一下吧</p>
                       </div>
                   ) : (
                       Array.from(savedCityIds).map(id => {
                           const city = cities.find(c => c.id === id);
                           if (!city) return null;
                           const config = getCategoryConfig(city.category);
                           return (
                               <div 
                                   key={id} 
                                   onClick={() => { setSelectedCityId(id); setIsFavOpen(false); }} 
                                   className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-2xl cursor-pointer border border-gray-100 transition-colors group"
                               >
                                   <div className={`w-10 h-10 rounded-full ${config.bg} flex items-center justify-center text-gray-700`}>
                                       {config.icon}
                                   </div>
                                   <div className="flex-1 min-w-0">
                                       <div className="font-bold text-gray-900 text-base">{city.name}</div>
                                       <div className="text-xs text-gray-500 truncate mt-0.5">{city.specialtyTitle}</div>
                                   </div>
                                   <ArrowRight size={18} className="text-gray-300 group-hover:text-black transition-colors"/>
                               </div>
                           )
                       })
                   )}
               </div>
            </div>
          </div>
        )}

        {/* EXPANDED Detail Card (Decision Dashboard) */}
        {selectedCity && (
          <div className="absolute top-6 left-6 z-[500] w-[400px] md:w-[450px] max-h-[90vh] overflow-y-auto custom-scrollbar bg-white/95 backdrop-blur-2xl rounded-[32px] shadow-[0_30px_60px_rgba(0,0,0,0.6)] border border-white/50 animate-in slide-in-from-left-4 fade-in duration-300">
             
             {/* Header Section */}
             <div className="p-6 pb-2 relative">
               <button 
                 onClick={() => setSelectedCityId(null)} 
                 className="absolute top-6 right-6 p-2 bg-gray-100/80 rounded-full hover:bg-gray-200 transition-colors z-10"
               >
                 <X size={18} className="text-gray-500"/>
               </button>

               <div className="flex items-center gap-2 mb-3">
                  <span className={`px-3 py-1 rounded-lg text-[12px] font-bold uppercase tracking-wide ${getCategoryConfig(selectedCity.category).bg} ${getCategoryConfig(selectedCity.category).text}`}>
                    {getCategoryConfig(selectedCity.category).label}
                  </span>
               </div>
               
               <h2 className="text-4xl font-extrabold text-black tracking-tight mb-2">{selectedCity.name}</h2>
               <p className="text-[15px] text-gray-500 font-medium flex flex-wrap gap-2">
                 {selectedCity.tags.map(t => <span key={t}>#{t}</span>)}
               </p>
             </div>

             {/* Basic Info Stats */}
             <div className="px-6 py-4">
                <div className="bg-gray-50 rounded-2xl p-4 flex justify-between items-center border border-gray-100">
                   <div className="text-center">
                      <div className="text-gray-400 text-[10px] font-bold uppercase mb-1">距离 (上海)</div>
                      <div className="text-lg font-bold text-black">{selectedCity.distanceFromShanghaiKm}<span className="text-sm font-normal text-gray-400">km</span></div>
                   </div>
                   <div className="w-[1px] h-8 bg-gray-200"></div>
                   <div className="text-center">
                      <div className="text-gray-400 text-[10px] font-bold uppercase mb-1">路费</div>
                      <div className="text-lg font-bold text-black">¥{selectedCity.tollCostCNY}</div>
                   </div>
                   <div className="w-[1px] h-8 bg-gray-200"></div>
                   <div className="text-center">
                      <div className="text-gray-400 text-[10px] font-bold uppercase mb-1">车程</div>
                      <div className="text-lg font-bold text-black">{selectedCity.driveTimeHours}<span className="text-sm font-normal text-gray-400">h</span></div>
                   </div>
                </div>
             </div>

             {/* Dynamic AI Analysis Section */}
             <div className="px-6 pb-6 space-y-5">
                
                {/* 1. Accomodation (IHG & Pets) */}
                <div className="bg-white rounded-xl">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-3">
                    <Hotel size={16} className="text-blue-600"/> 住宿 & 宠物友好
                  </h3>
                  {detailLoading ? (
                    <div className="h-16 bg-gray-100 rounded-lg animate-pulse"></div>
                  ) : deepDiveData && deepDiveData.hotelInfo ? (
                    <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100 space-y-2">
                       {deepDiveData.hotelInfo.hasIHG ? (
                         <div className="flex items-start gap-2">
                           <div className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5">IHG</div>
                           <div>
                             <p className="text-sm font-bold text-gray-800">{deepDiveData.hotelInfo.ihgName || "当地有 IHG 旗下酒店"}</p>
                             <p className="text-xs text-gray-600 mt-0.5">
                               {deepDiveData.hotelInfo.ihgPetFriendly 
                                 ? "✅ 且该酒店支持宠物入住 (具体请二次确认)" 
                                 : "⚠️ 该 IHG 酒店可能不支持宠物"}
                             </p>
                           </div>
                         </div>
                       ) : (
                         <div className="text-sm text-gray-600">暂无 IHG 酒店。</div>
                       )}
                       
                       {(!deepDiveData.hotelInfo.hasIHG || !deepDiveData.hotelInfo.ihgPetFriendly) && deepDiveData.hotelInfo.alternativePetHotel && (
                          <div className="pt-2 border-t border-blue-100">
                            <span className="text-xs text-blue-600 font-bold">替代方案：</span>
                            <span className="text-xs text-gray-700"> {deepDiveData.hotelInfo.alternativePetHotel} (宠物友好)</span>
                          </div>
                       )}
                    </div>
                  ) : <div className="text-xs text-gray-400">正在获取酒店信息...</div>}
                </div>

                {/* 2. Seasonality & Culture */}
                <div>
                   <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-3">
                    <Calendar size={16} className="text-red-500"/> 当下时令 & 民俗
                  </h3>
                  {detailLoading ? (
                    <div className="h-20 bg-gray-100 rounded-lg animate-pulse"></div>
                  ) : deepDiveData ? (
                    <div className="space-y-3">
                       {/* Seasonality */}
                       {deepDiveData.seasonality && (
                        <div className="bg-gradient-to-r from-red-50 to-orange-50 p-4 rounded-xl border border-red-100">
                            <div className="flex items-start gap-3">
                                <span className="shrink-0 font-bold text-red-600 text-sm pt-0.5">{deepDiveData.seasonality.verdict}</span>
                                <div className="w-[1px] h-auto self-stretch bg-red-200 shrink-0 my-1"></div>
                                <p className="text-sm text-gray-800 leading-relaxed">
                                    {deepDiveData.seasonality.currentVibe}
                                </p>
                            </div>
                        </div>
                       )}

                       {/* Culture */}
                       {deepDiveData.culture && (
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-start gap-3">
                            <div className="bg-white p-2 rounded-lg shadow-sm text-2xl">🏮</div>
                            <div>
                                <h4 className="text-sm font-bold text-gray-900">{deepDiveData.culture.name}</h4>
                                <p className="text-xs text-gray-600 mt-1 leading-relaxed">{deepDiveData.culture.description}</p>
                                <div className="mt-2 flex items-center gap-2">
                                <Clock size={12} className="text-gray-400"/>
                                <span className="text-xs text-gray-500">{deepDiveData.culture.timing}</span>
                                {deepDiveData.culture.isVisibleNow ? (
                                    <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">当前可见</span>
                                ) : (
                                    <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded font-bold">非当季</span>
                                )}
                                </div>
                            </div>
                        </div>
                       )}
                    </div>
                  ) : <div className="text-xs text-gray-400">正在分析时令...</div>}
                </div>

                {/* 3. Food & Spots Grid */}
                <div className="grid grid-cols-2 gap-4">
                   {/* Food */}
                   <div>
                      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-3">
                        <Utensils size={16} className="text-orange-500"/> 特色美食
                      </h3>
                      {detailLoading ? (
                        <div className="h-20 bg-gray-100 rounded-lg animate-pulse"></div>
                      ) : deepDiveData && deepDiveData.food ? (
                        <ul className="space-y-2">
                           {deepDiveData.food.map((f, i) => (
                             <li key={i} className="text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                               🍜 {f}
                             </li>
                           ))}
                        </ul>
                      ) : null}
                   </div>

                   {/* Spots */}
                   <div>
                      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-3">
                        <Camera size={16} className="text-purple-500"/> 必打卡
                      </h3>
                      {detailLoading ? (
                        <div className="h-20 bg-gray-100 rounded-lg animate-pulse"></div>
                      ) : deepDiveData && deepDiveData.mustVisit ? (
                        <ul className="space-y-2">
                           {deepDiveData.mustVisit.map((s, i) => (
                             <li key={i} className="text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                               📸 {s}
                             </li>
                           ))}
                        </ul>
                      ) : null}
                   </div>
                </div>

             </div>

             {/* Footer Action: Updated to Save Location */}
             <div className="p-6 pt-2 sticky bottom-0 bg-white/80 backdrop-blur-md">
               <button 
                onClick={() => toggleSaveCity(selectedCity.id)}
                className="w-full py-4 bg-black hover:bg-gray-800 active:scale-[0.98] text-white rounded-2xl font-bold text-base transition-all shadow-xl shadow-black/20 flex items-center justify-center gap-2"
               >
                 <Heart size={20} className={savedCityIds.has(selectedCity.id) ? "fill-white text-white" : "text-white"} />
                 {savedCityIds.has(selectedCity.id) ? "已收藏" : "收藏地点"}
               </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);