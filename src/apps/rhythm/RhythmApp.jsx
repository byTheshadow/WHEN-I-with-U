import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  Clock, 
  MapPin, 
  User, 
  Calendar,
  Briefcase,
  GraduationCap,
  Sparkles
} from 'lucide-react';
import db from '../../db';

// 辅助函数：将周次数组折叠为易读格式（如 [1,2,3,4] -> "1-4周"）
const formatWeeks = (weeksArray) => {
  if (!weeksArray || weeksArray.length === 0) return '单次日程';
  if (weeksArray.length >= 20) return '全学期常驻';
  
  const sorted = [...weeksArray].sort((a, b) => a - b);
  const ranges = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `${start}周` : `${start}-${end}周`);
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push(start === end ? `${start}周` : `${start}-${end}周`);
  return `第 ${ranges.join(', ')}`;
};

// 获取本周某星期几的真实日期 (YYYY-MM-DD)
const getDateOfCurrentWeekDay = (targetDayOfWeek) => {
  const today = new Date();
  const currentDay = today.getDay() || 7; // 1-7
  const distance = targetDayOfWeek - currentDay;
  const targetDate = new Date(today.setDate(today.getDate() + distance));
  return targetDate.toISOString().split('T')[0];
};

// 优雅的日期中文朗读格式 (如 "2026-08-27" -> "8月27日")
const formatChineseDate = (dateStr) => {
  if (!dateStr) return '';
  const [_, m, d] = dateStr.split('-');
  return `${parseInt(m, 10)}月${parseInt(d, 10)}日`;
};

export default function RhythmApp({ onBackHub, currentCharacterId }) {
  const [schedules, setSchedules] = useState([]);
  const [activeDay, setActiveDay] = useState(new Date().getDay() || 7); // 1-7
  const [activePromptTab, setActivePromptTab] = useState('student'); // student, worker
  
  // 日程模式选择: repeat (每周重复) / oneoff (单次不重复)
  const [scheduleMode, setScheduleMode] = useState('repeat'); 
  
  // 表单状态
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [weeks, setWeeks] = useState('1-16');
  const [location, setLocation] = useState('');
  const [teacher, setTeacher] = useState('');
  const [category, setCategory] = useState('course'); // course, work, life
  
  const [pasteData, setPasteData] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const weekDays = [
    { label: '周一', value: 1 },
    { label: '周二', value: 2 },
    { label: '周三', value: 3 },
    { label: '周四', value: 4 },
    { label: '周五', value: 5 },
    { label: '周六', value: 6 },
    { label: '周日', value: 7 }
  ];

  // 外部 AI Prompt，加入了单次日程格式说明
  const getPromptText = () => {
    return `你是一个专业的时间数据格式化助手。请帮我将以下给出的【个人日程表】整理成标准的 JSON 数据。

要求：
1. 只输出标准的 JSON 数组格式，没有任何其他说明文本、解释或 Emoji。
2. JSON 数组中每个对象必须且只能包含以下字段：
  - "title": 日程或课目标题（例如："算法导论"、"周例会"、"去看牙医"）
  - "category": 类型，必须是 "course"（课表）、"work"（工作）或 "life"（生活/出行）之一
  - "startTime": 开始时间，格式 "HH:MM"（例如："08:30"）
  - "endTime": 结束时间，格式 "HH:MM"（例如："10:15"）
  - "location": 地点（字符串，若无则填空字串 ""）
  - "teacher": 对接人/老师（字符串，若无则填空字串 ""）
  - "date": 【如果是单次不重复日程，在此填写具体的日期格式 "YYYY-MM-DD"；如果是每周重复日程，此字段请不要填或设为 null】
  - "dayOfWeek": 星期几，数字 1-7（如果设定了 date 字段，请根据 date 计算出星期几填入；如果是每周重复日程，根据日程描述填写）
  - "weeks": 数组格式，如果是每周重复日程，表示上课或重复的周次（如 1 到 16 周写 [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]；单次日程此字段可填空数组 []）

我的日程文本如下：
------------------------
[在此替换粘贴你的日程，例如：
 1. 每周一早八在教三102上高数，李老师的课。
 2. 本周四（2026年8月27日）下午两点到四点要去医院看牙医。
]
------------------------`;
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(getPromptText());
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const loadSchedules = async () => {
    try {
      const data = await db.schedules
        .where('characterId')
        .equals(currentCharacterId || 0)
        .toArray();
      data.sort((a, b) => a.startTime.localeCompare(b.startTime));
      setSchedules(data);
    } catch (err) {
      console.error('读取日程数据失败:', err);
    }
  };

  useEffect(() => {
    loadSchedules();
  }, [currentCharacterId]);

  const handleImportJson = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      let cleanData = pasteData.trim();
      if (cleanData.startsWith('```json')) {
        cleanData = cleanData.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (cleanData.startsWith('```')) {
        cleanData = cleanData.replace(/^```/, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(cleanData);
      if (!Array.isArray(parsed)) {
        throw new Error('导入的日程格式必须为数组列表');
      }

      const validated = parsed.map((item, index) => {
        if (!item.title || !item.dayOfWeek || !item.startTime || !item.endTime) {
          throw new Error(`第 ${index + 1} 个日程信息不完整(必填: title, dayOfWeek, startTime, endTime)`);
        }
        
        let parsedWeeks = [];
        if (!item.date && Array.isArray(item.weeks) && item.weeks.length > 0) {
          parsedWeeks = item.weeks.map(Number);
        } else if (!item.date) {
          // 重复日程默认填满
          parsedWeeks = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20];
        }

        return {
          characterId: currentCharacterId || 0,
          title: String(item.title).trim(),
          dayOfWeek: Number(item.dayOfWeek),
          startTime: String(item.startTime).trim(),
          endTime: String(item.endTime).trim(),
          weeks: parsedWeeks,
          date: item.date ? String(item.date).trim() : null, // 单次日程日期
          location: String(item.location || '').trim(),
          teacher: String(item.teacher || '').trim(),
          category: ['course', 'work', 'life'].includes(item.category) ? item.category : 'life',
          createdAt: new Date().toISOString()
        };
      });

      await db.transaction('rw', db.schedules, async () => {
        for (const schedule of validated) {
          await db.schedules.add(schedule);
        }
      });

      setSuccessMsg(`成功同步了 ${validated.length} 项生活日程。`);
      setPasteData('');
      loadSchedules();
    } catch (err) {
      setErrorMsg(`解析失败: ${err.message}`);
    }
  };

  const handleAddSingle = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    let parsedWeeks = [];
    let savedDate = null;
    let savedDayOfWeek = Number(dayOfWeek);

    if (scheduleMode === 'oneoff') {
      savedDate = date;
      // 从选定日期中解析出周几 (JS的 getDay() 0是周日)
      const parsedDate = new Date(date);
      savedDayOfWeek = parsedDate.getDay() || 7;
    } else {
      if (weeks.includes('-')) {
        const [start, end] = weeks.split('-').map(Number);
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = start; i <= end; i++) parsedWeeks.push(i);
        }
      } else {
        parsedWeeks = weeks.split(',').map(Number).filter(n => !isNaN(n));
      }
      if (parsedWeeks.length === 0) {
        parsedWeeks = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20];
      }
    }

    try {
      await db.schedules.add({
        characterId: currentCharacterId || 0,
        title: title.trim(),
        dayOfWeek: savedDayOfWeek,
        startTime,
        endTime,
        weeks: parsedWeeks,
        date: savedDate,
        location: location.trim(),
        teacher: teacher.trim(),
        category,
        createdAt: new Date().toISOString()
      });

      setTitle('');
      setLocation('');
      setTeacher('');
      loadSchedules();
      setSuccessMsg('日程添加成功。');
    } catch (err) {
      setErrorMsg(`添加失败: ${err.message}`);
    }
  };

  const handleDelete = async (id) => {
    try {
      await db.schedules.delete(id);
      loadSchedules();
    } catch (err) {
      console.error('删除日程失败:', err);
    }
  };

  const getCategoryLabel = (cat) => {
    switch (cat) {
      case 'course': return '课程';
      case 'work': return '工作';
      default: return '日常';
    }
  };

  // 过滤出当前选定星期几需要展现的日程
  // 包含：该星期的重复日程 + 日期落在本周该星期的单次日程
  const targetWeekDate = getDateOfCurrentWeekDay(activeDay);
  
  const filteredSchedules = schedules.filter(s => {
    if (s.date) {
      // 如果是单次日程，判定其具体日期是否等于本周该天对应的真实日期
      return s.date === targetWeekDate;
    }
    // 否则根据星期判定
    return s.dayOfWeek === activeDay;
  });

  return (
    <div className="flex flex-col min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)] font-serif p-4 max-w-[420px] mx-auto pb-24">
      {/* 头部标题 */}
      <div className="flex items-center justify-between mb-8 pb-3 border-b border-dashed border-[var(--theme-border)]">
        <button onClick={onBackHub} className="p-1 hover:opacity-75 transition-opacity" aria-label="返回">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-base font-bold tracking-widest text-center">时光作息 Rhythm</span>
        <div className="w-5 h-5" />
      </div>

      {/* 星期选择滑块 */}
      <div className="flex justify-between items-center gap-1 mb-8 py-2 px-1.5 bg-black/[0.02] rounded-xl overflow-x-auto">
        {weekDays.map((day) => (
          <button
            key={day.value}
            onClick={() => setActiveDay(day.value)}
            className={`flex-1 py-2 text-[11px] rounded-lg transition-all text-center min-w-[44px] ${
              activeDay === day.value
                ? 'bg-white shadow-sm font-bold border-b border-[var(--theme-accent)] text-[var(--theme-accent)]'
                : 'opacity-50'
            }`}
          >
            {day.label}
          </button>
        ))}
      </div>

      {/* 日程展示区 */}
      <div className="flex-1 mb-10">
        <h3 className="text-xs font-semibold mb-6 tracking-wider text-[var(--theme-text-muted)] flex items-center gap-2">
          <Calendar className="w-4 h-4" /> 
          <span>今日时间规划（{formatChineseDate(targetWeekDate)}）</span>
        </h3>
        
        {filteredSchedules.length === 0 ? (
          <div className="py-14 text-center text-xs italic text-[var(--theme-text-muted)] border border-dashed border-[var(--theme-border)] rounded-2xl bg-white/10">
            这一天看起来空落落的
          </div>
        ) : (
          <div className="space-y-6">
            {filteredSchedules.map((item) => (
              <div 
                key={item.id} 
                className="relative p-5 pt-7 border border-[var(--theme-border)] rounded-xl bg-gradient-to-br from-[var(--theme-card-bg,rgba(255,255,255,0.7))] to-white/30 shadow-[0_4px_12px_rgba(0,0,0,0.02)] hover:shadow-md transition-all group rotate-[-0.5deg]"
              >
                {/* 拟物装饰：半透明手撕纸胶带效果 */}
                <div 
                  className="absolute top-[-9px] left-[35%] right-[35%] h-4.5 bg-white/60 dark:bg-black/25 backdrop-blur-[1px] rotate-[1.2deg] border-x border-dashed border-black/10 flex items-center justify-center pointer-events-none"
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--theme-border)] opacity-30" />
                </div>

                {/* 删除按钮 */}
                <button
                  onClick={() => handleDelete(item.id)}
                  className="absolute right-3.5 top-3.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-[var(--theme-text-muted)] hover:text-red-500"
                  title="撕掉此便签"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                {/* 卡片主体 */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    {/* 文艺边缘标注式类别 Tag */}
                    <span className="text-[10px] tracking-wider font-sans opacity-45 px-1.5 py-0.5 border border-dashed border-[var(--theme-border)] rounded">
                      {getCategoryLabel(item.category)}
                    </span>
                    <h4 className="font-bold text-sm tracking-wide">{item.title}</h4>
                  </div>

                  <div className="space-y-2 text-[11px] text-[var(--theme-text-muted)] font-sans tracking-wide">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 opacity-70" />
                      <span>{item.startTime} - {item.endTime}</span>
                    </div>
                    
                    {item.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 opacity-70" />
                        <span className="truncate">{item.location}</span>
                      </div>
                    )}

                    {item.teacher && (
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 opacity-70" />
                        <span className="truncate">{item.teacher}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1 border-t border-[var(--theme-border)] border-dashed opacity-85">
                      <Calendar className="w-3.5 h-3.5 opacity-70" />
                      <span>
                        {item.date ? `单次日程 · ${formatChineseDate(item.date)}` : formatWeeks(item.weeks)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 导入与手动添加区 */}
      <div className="border-t border-dashed border-[var(--theme-border)] pt-8 space-y-8">
        
        {/* 外部 AI 导入 */}
        <div className="p-5 bg-black/[0.01] border border-[var(--theme-border)] rounded-2xl relative">
          <h4 className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-[var(--theme-accent)]" /> 智能导入作息</span>
            <button 
              onClick={handleCopyPrompt}
              className="flex items-center gap-1 text-[var(--theme-accent)] hover:opacity-85 text-xs font-sans font-normal"
            >
              {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {isCopied ? '已复制' : '复制提示词'}
            </button>
          </h4>

          <p className="text-[10px] leading-relaxed text-[var(--theme-text-muted)] mb-4">
            复制提示词发给任意外部大模型，并将你的**课表文本**或**日常工作日程**直接发给它。它会为你抽取为干净的 JSON。直接粘贴到下方即可导入。
          </p>

          <textarea
            value={pasteData}
            onChange={(e) => setPasteData(e.target.value)}
            placeholder="在此处粘贴 AI 整理生成的 JSON 数据..."
            className="w-full h-24 p-3 text-xs border border-[var(--theme-border)] rounded-xl bg-[var(--theme-bg)] focus:outline-none focus:border-[var(--theme-accent)] font-mono resize-none mb-3"
          />

          <button
            onClick={handleImportJson}
            disabled={!pasteData.trim()}
            className="w-full py-2 bg-[var(--theme-text)] text-[var(--theme-bg)] text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            解析并导入日程
          </button>
        </div>

        {/* 手动添加 */}
        <details className="group border border-[var(--theme-border)] rounded-2xl overflow-hidden">
          <summary className="flex justify-between items-center p-4 text-xs font-bold tracking-wider cursor-pointer bg-[rgba(0,0,0,0.01)] hover:bg-[rgba(0,0,0,0.03)] select-none">
            <span>手动新建便签日程</span>
            <Plus className="w-4 h-4 group-open:rotate-45 transition-transform" />
          </summary>
          
          <form onSubmit={handleAddSingle} className="p-5 space-y-4 border-t border-[var(--theme-border)] text-xs">
            <div className="grid grid-cols-2 gap-4">
              
              {/* 日程重复模式选择 */}
              <div className="col-span-2 flex border-b border-[var(--theme-border)] pb-2 text-[10px] font-sans">
                <button
                  type="button"
                  onClick={() => setScheduleMode('repeat')}
                  className={`flex-1 py-1 text-center rounded-md transition-all ${
                    scheduleMode === 'repeat' ? 'bg-[var(--theme-text)] text-[var(--theme-bg)] font-bold' : 'opacity-60'
                  }`}
                >
                  每周重复
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleMode('oneoff')}
                  className={`flex-1 py-1 text-center rounded-md transition-all ${
                    scheduleMode === 'oneoff' ? 'bg-[var(--theme-text)] text-[var(--theme-bg)] font-bold' : 'opacity-60'
                  }`}
                >
                  单次不重复
                </button>
              </div>

              <div className="col-span-2">
                <label className="block mb-1 font-semibold text-[var(--theme-text-muted)]">日程/课程名称</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="如：高等数学 / 项目例会"
                  className="w-full p-2.5 border border-[var(--theme-border)] rounded-lg bg-[var(--theme-bg)] focus:outline-none"
                />
              </div>

              {scheduleMode === 'oneoff' ? (
                // 单次日程日期选择
                <div className="col-span-2">
                  <label className="block mb-1 font-semibold text-[var(--theme-text-muted)]">选择日期</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full p-2.5 border border-[var(--theme-border)] rounded-lg bg-[var(--theme-bg)] focus:outline-none font-sans"
                  />
                </div>
              ) : (
                // 重复日程参数选择
                <>
                  <div>
                    <label className="block mb-1 font-semibold text-[var(--theme-text-muted)]">重复星期</label>
                    <select
                      value={dayOfWeek}
                      onChange={(e) => setDayOfWeek(Number(e.target.value))}
                      className="w-full p-2.5 border border-[var(--theme-border)] rounded-lg bg-[var(--theme-bg)] focus:outline-none"
                    >
                      {weekDays.map(d => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1 font-semibold text-[var(--theme-text-muted)]">持续周次 (如 1-16 或 1,3,5)</label>
                    <input
                      type="text"
                      value={weeks}
                      onChange={(e) => setWeeks(e.target.value)}
                      className="w-full p-2.5 border border-[var(--theme-border)] rounded-lg bg-[var(--theme-bg)] focus:outline-none font-sans"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block mb-1 font-semibold text-[var(--theme-text-muted)]">类型</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-2.5 border border-[var(--theme-border)] rounded-lg bg-[var(--theme-bg)] focus:outline-none"
                >
                  <option value="course">课表/学习</option>
                  <option value="work">工作/会议</option>
                  <option value="life">生活/私人日程</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2 col-span-1">
                <div>
                  <label className="block mb-1 font-semibold text-[var(--theme-text-muted)]">开始</label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full p-2 border border-[var(--theme-border)] rounded-lg bg-[var(--theme-bg)] font-sans"
                  />
                </div>
                <div>
                  <label className="block mb-1 font-semibold text-[var(--theme-text-muted)]">结束</label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full p-2 border border-[var(--theme-border)] rounded-lg bg-[var(--theme-bg)] font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 font-semibold text-[var(--theme-text-muted)]">教室/会议室 (选填)</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="如：教一302 / 线上"
                  className="w-full p-2.5 border border-[var(--theme-border)] rounded-lg bg-[var(--theme-bg)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block mb-1 font-semibold text-[var(--theme-text-muted)]">老师/关联人 (选填)</label>
                <input
                  type="text"
                  value={teacher}
                  onChange={(e) => setTeacher(e.target.value)}
                  placeholder="如：项目发起人"
                  className="w-full p-2.5 border border-[var(--theme-border)] rounded-lg bg-[var(--theme-bg)] focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-[var(--theme-text)] text-[var(--theme-bg)] font-bold rounded-lg hover:opacity-90 transition-opacity"
            >
              将便签贴入日程
            </button>
          </form>
        </details>
      </div>

      {errorMsg && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="mt-4 p-3 bg-green-50 text-green-700 text-xs rounded-xl border border-green-200">
          {successMsg}
        </div>
      )}
    </div>
  );
}


