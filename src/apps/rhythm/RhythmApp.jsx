import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  Calendar,
  Settings,
  X
} from 'lucide-react';
import db from '../../db';

export default function RhythmApp({ onBackHub, currentCharacterId }) {
  const [schedules, setSchedules] = useState([]);
  const [activeDay, setActiveDay] = useState(new Date().getDay() || 7);
  const [activePromptTab, setActivePromptTab] = useState('student');
  
  // 开学日期配置状态
  const [termStartDate, setTermStartDate] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(1);

  // 新建日程表单状态
  const [isRepeating, setIsRepeating] = useState(true); // true 为每周重复，false 为单次日程
  const [singleDate, setSingleDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [title, setTitle] = useState('');
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

  // 计算当前是第几周
  const calculateCurrentWeek = (startDateStr) => {
    if (!startDateStr) return 1;
    try {
      const now = new Date();
      const start = new Date(startDateStr);
      // 将时间设为当天清晨做计算
      start.setHours(0,0,0,0);
      now.setHours(0,0,0,0);
      
      const diffTime = now - start;
      if (diffTime < 0) return 1; // 还没开学
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const week = Math.floor(diffDays / 7) + 1;
      return week <= 25 ? week : 1;
    } catch {
      return 1;
    }
  };

  // 读取与保存开学日期设定
  useEffect(() => {
    const loadConfig = async () => {
      const saved = await db.settings.get('term_start_date');
      if (saved?.value) {
        setTermStartDate(saved.value);
        setCurrentWeek(calculateCurrentWeek(saved.value));
      }
    };
    loadConfig();
  }, []);

  const handleSaveTermStart = async () => {
    if (!termStartDate) return;
    await db.settings.put({ key: 'term_start_date', value: termStartDate });
    setCurrentWeek(calculateCurrentWeek(termStartDate));
    setShowConfig(false);
    setSuccessMsg('学期开学日期设定已更新。');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // 针对不同人群生成的外部 AI 提示词
  const getPromptText = () => {
    return `你是一个专业的时间数据格式化助手。请帮我将以下给出的【日程/课表文本】整理成标准的 JSON 数据。

要求：
1. 只输出标准的 JSON 数组格式，没有任何其他 markdown 语法、解释文本或 Emoji。
2. JSON 数组中每个对象必须且只能包含以下字段：
  - "title": 日程或课程名称（例如："高等数学"、"每周例会"、"去寄快递"）
  - "category": 类型，必须是 "course"（课表）、"work"（工作/会议）或 "life"（生活日常/通勤）之一
  - "startTime": 开始时间，格式 "HH:MM"（例如："08:00"、"18:30"）
  - "endTime": 结束时间，格式 "HH:MM"（例如："09:45"、"19:30"）
  - "isRepeating": 布尔值。如果是每周重复的日程/课表填 true；如果是某一天发生的单次事件填 false
  - "date": 字符串，格式 "YYYY-MM-DD"。如果是单次事件(isRepeating为false)填具体日期；如果是每周重复事件，填空字串 ""
  - "dayOfWeek": 星期几，数字 1-7。如果 isRepeating 为 true，根据星期几填写（1代表周一，7代表周日）；若 isRepeating 为 false 填 0
  - "weeks": 数组格式，表示课表进行的周次。
    * 如果是课程(category为"course")，按照实际周次填写（如 1 到 16 周写 [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]）
    * 如果是非课程的日程，默认为空数组 []
  - "location": 教室或会议室地点（字符串，没有填 ""）
  - "teacher": 授课老师或对接人（字符串，没有填 ""）

我的日程文本如下：
------------------------
[在此替换粘贴你的日程文本，例如：
周一早八教三101高数，周四下午两点综合楼302大学英语。
或者：
周一至周五 09:00-10:00 地铁通勤。8月30日上午10点在2楼会议室召开项目启动会。
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
      console.error('读取作息数据失败:', err);
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
        if (!item.title || !item.startTime || !item.endTime) {
          throw new Error(`第 ${index + 1} 个日程信息不完整(必填: title, startTime, endTime)`);
        }
        
        const rep = item.isRepeating !== false;
        
        let parsedWeeks = [];
        if (Array.isArray(item.weeks) && item.weeks.length > 0) {
          parsedWeeks = item.weeks.map(Number);
        } else if (item.category === 'course' && rep) {
          parsedWeeks = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16];
        }

        // 计算 dayOfWeek (如果是非重复的，算出具体日期是星期几)
        let dow = Number(item.dayOfWeek || 1);
        if (!rep && item.date) {
          const dObj = new Date(item.date);
          dow = dObj.getDay() || 7;
        }

        return {
          characterId: currentCharacterId || 0,
          title: String(item.title).trim(),
          dayOfWeek: dow,
          startTime: String(item.startTime).trim(),
          endTime: String(item.endTime).trim(),
          isRepeating: rep,
          date: rep ? '' : String(item.date || ''),
          weeks: parsedWeeks,
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
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(`解析失败: ${err.message}`);
    }
  };

  const handleAddSingle = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    let parsedWeeks = [];
    if (isRepeating && category === 'course') {
      if (weeks.includes('-')) {
        const [start, end] = weeks.split('-').map(Number);
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = start; i <= end; i++) parsedWeeks.push(i);
        }
      } else {
        parsedWeeks = weeks.split(',').map(Number).filter(n => !isNaN(n));
      }
    }

    let targetDayOfWeek = Number(dayOfWeek);
    if (!isRepeating && singleDate) {
      const dObj = new Date(singleDate);
      targetDayOfWeek = dObj.getDay() || 7;
    }

    try {
      await db.schedules.add({
        characterId: currentCharacterId || 0,
        title: title.trim(),
        dayOfWeek: targetDayOfWeek,
        startTime,
        endTime,
        isRepeating,
        date: isRepeating ? '' : singleDate,
        weeks: parsedWeeks,
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
      setTimeout(() => setSuccessMsg(''), 3000);
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

  // 根据当前 activeDay（周几）以及具体的日期筛选出今日日程
  const getTodaySchedules = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    return schedules.filter(s => {
      if (s.isRepeating) {
        return s.dayOfWeek === activeDay;
      } else {
        // 单次事件：如果选择查看的星期刚好对应单次事件的日期，或者刚好就是单次事件设定的那一天
        if (s.date) {
          const sDateObj = new Date(s.date);
          const dow = sDateObj.getDay() || 7;
          return dow === activeDay;
        }
        return false;
      }
    });
  };

  const filteredSchedules = getTodaySchedules();

  return (
    <div className="flex flex-col min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)] font-serif p-4 max-w-[420px] mx-auto pb-24 text-left">
      {/* 头部标题栏 */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-dashed border-[var(--theme-border)]">
        <button onClick={onBackHub} className="p-1 hover:opacity-75 transition-opacity" aria-label="返回">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-lg font-bold tracking-widest text-center">时光作息 Rhythm</span>
        <button 
          onClick={() => setShowConfig(!showConfig)}
          className="p-1 hover:opacity-75 transition-opacity text-[var(--theme-text-muted)]"
          title="开学日期设置"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* 学期第一周配置气泡（小书签） */}
      {showConfig && (
        <div className="mb-6 p-4 border border-dashed border-[var(--theme-border)] bg-[rgba(0,0,0,0.01)] rounded-lg text-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold">设定开学周一 (计算当前学周)</span>
            <button onClick={() => setShowConfig(false)}><X className="w-4 h-4" /></button>
          </div>
          <p className="text-[10px] text-[var(--theme-text-muted)] leading-relaxed">
            仅学生党需要配置。配置后系统会根据此日期自动算得当前的学周次，用以在上课日自动进行日程关照。
          </p>
          <div className="flex gap-2">
            <input 
              type="date" 
              value={termStartDate} 
              onChange={(e) => setTermStartDate(e.target.value)}
              className="flex-1 p-1.5 border border-[var(--theme-border)] rounded bg-[var(--theme-bg)] font-sans"
            />
            <button 
              onClick={handleSaveTermStart}
              className="px-4 py-1.5 bg-[var(--theme-text)] text-[var(--theme-bg)] rounded font-sans font-bold"
            >
              确定
            </button>
          </div>
        </div>
      )}

      {/* 学期进度挂签（仅当配置了开学日期时显示） */}
      {termStartDate && (
        <div className="mb-4 text-center">
          <span className="inline-block px-3 py-1 rounded-full text-[10px] uppercase font-mono tracking-widest bg-[var(--control-soft-bg,rgba(0,0,0,0.03))] border border-[var(--theme-border)]">
            School Calendar / Week {currentWeek}
          </span>
        </div>
      )}

      {/* 星期选择滑块 */}
      <div className="flex justify-between items-center gap-1 mb-6 py-2 px-1 bg-[rgba(0,0,0,0.02)] rounded-lg overflow-x-auto">
        {weekDays.map((day) => (
          <button
            key={day.value}
            onClick={() => setActiveDay(day.value)}
            className={`flex-1 py-2 text-xs rounded transition-all text-center min-w-[40px] ${
              activeDay === day.value
                ? 'bg-[var(--theme-accent-bg,rgba(0,0,0,0.05))] font-bold border-b-2 border-[var(--theme-accent)]'
                : 'opacity-60'
            }`}
          >
            {day.label}
          </button>
        ))}
      </div>

      {/* 拟物化撕裂票根日程卡片区 */}
      <div className="flex-1 mb-8">
        <h3 className="text-xs font-semibold mb-4 tracking-wider text-[var(--theme-text-muted)] flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" /> 今日日程票根
        </h3>
        
        {filteredSchedules.length === 0 ? (
          <div className="py-12 text-center text-xs italic text-[var(--theme-text-muted)] border border-dashed border-[var(--theme-border)] rounded-lg">
            此页尚未夹入任何日程纸条。
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSchedules.map((item) => {
              // 类别显示文字
              const categoryLabels = { course: 'Course', work: 'Work', life: 'Life' };
              const typeLabel = categoryLabels[item.category] || 'Life';
              
              return (
                <div 
                  key={item.id} 
                  className="flex border border-[var(--theme-border)] rounded bg-[var(--theme-card-bg,rgba(255,255,255,0.45))] shadow-sm relative group overflow-hidden"
                >
                  {/* 左侧：时间撕切联 (Time Stub) */}
                  <div className="w-[100px] shrink-0 p-3 bg-[rgba(0,0,0,0.015)] flex flex-col justify-center items-center text-center select-none border-r border-dashed border-[var(--theme-border)]">
                    <span className="font-mono text-[13px] font-bold tracking-tight">
                      {item.startTime}
                    </span>
                    <div className="h-2 w-px bg-[var(--theme-border)] my-1 opacity-60" />
                    <span className="font-mono text-[11px] opacity-50">
                      {item.endTime}
                    </span>
                  </div>

                  {/* 右侧：日程详情联 */}
                  <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h4 className="font-bold text-[13px] truncate pr-4 text-[var(--theme-text)]">
                          {item.title}
                        </h4>
                        <span className="font-mono text-[9px] uppercase tracking-wider opacity-40 shrink-0 select-none">
                          [{typeLabel}]
                        </span>
                      </div>

                      {/* 动态元数据 (只有存在时才占位展示，保持诗意留白) */}
                      <div className="text-[10px] space-y-0.5 text-[var(--theme-text-muted)] font-mono">
                        {item.location && (
                          <div className="truncate">At: {item.location}</div>
                        )}
                        {item.teacher && (
                          <div className="truncate">With: {item.teacher}</div>
                        )}
                      </div>
                    </div>

                    {/* 日程周期详情 */}
                    <div className="mt-2 text-[9px] font-mono opacity-50 border-t border-[rgba(0,0,0,0.03)] pt-1.5 flex justify-between items-center">
                      <span>
                        {!item.isRepeating && item.date ? (
                          `Once: ${item.date}`
                        ) : item.category === 'course' && item.weeks?.length > 0 ? (
                          `Weeks: ${item.weeks[0]}-${item.weeks[item.weeks.length - 1]}`
                        ) : (
                          'Every week repeat'
                        )}
                      </span>
                    </div>
                  </div>

                  {/* 删除按钮 */}
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-[var(--theme-text-muted)] hover:text-red-500"
                    title="撕去此页"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 导入区与手动添加折叠 */}
      <div className="border-t border-dashed border-[var(--theme-border)] pt-6 space-y-6">
        {/* 外部 AI 导入向导 */}
        <div className="p-4 bg-[var(--theme-accent-bg,rgba(0,0,0,0.015))] border border-[var(--theme-border)] rounded-lg">
          <h4 className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>使用外部 AI 助理导入</span>
            <button 
              onClick={handleCopyPrompt}
              className="flex items-center gap-1 text-[var(--theme-accent)] hover:opacity-85 text-xs font-sans font-normal"
            >
              {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {isCopied ? '复制解析提示词' : '复制解析提示词'}
            </button>
          </h4>

          <p className="text-[10px] leading-relaxed text-[var(--theme-text-muted)] mb-3">
            点击复制上面的解析提示词，发给任意外部 AI（如 Claude/ChatGPT），并将你的课表文本、工作时间安排发给它。它会为你提取为标准的 JSON 序列，然后直接贴回在下方导入。
          </p>

          <textarea
            value={pasteData}
            onChange={(e) => setPasteData(e.target.value)}
            placeholder="粘贴 AI 吐出的 JSON 文本..."
            className="w-full h-20 p-2 text-xs border border-[var(--theme-border)] rounded bg-[var(--theme-bg)] focus:outline-none focus:border-[var(--theme-accent)] font-mono resize-none mb-3"
          />

          <button
            onClick={handleImportJson}
            disabled={!pasteData.trim()}
            className="w-full py-2 bg-[var(--theme-accent)] text-white text-xs font-bold rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            导入日程票根
          </button>
        </div>

        {/* 手动添加单条日程 */}
        <details className="group border border-[var(--theme-border)] rounded bg-[rgba(0,0,0,0.005)]">
          <summary className="flex justify-between items-center p-3 text-xs font-bold tracking-wider cursor-pointer select-none">
            <span>手动填写日程纸条</span>
            <Plus className="w-4 h-4 group-open:rotate-45 transition-transform" />
          </summary>
          
          <form onSubmit={handleAddSingle} className="p-4 space-y-4 border-t border-[var(--theme-border)] text-xs">
            <div className="grid grid-cols-2 gap-3">
              
              {/* 重复选项 */}
              <div className="col-span-2">
                <label className="block mb-1 font-semibold text-[var(--theme-text-muted)]">日程模式</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input 
                      type="radio" 
                      checked={isRepeating} 
                      onChange={() => setIsRepeating(true)}
                    />
                    每周重复安排
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input 
                      type="radio" 
                      checked={!isRepeating} 
                      onChange={() => setIsRepeating(false)}
                    />
                    仅限单次事件
                  </label>
                </div>
              </div>

              <div className="col-span-2">
                <label className="block mb-1 font-semibold text-[var(--theme-text-muted)]">日程/课程名称</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="如：高数 / 通勤 / 团队站会"
                  className="w-full p-2 border border-[var(--theme-border)] rounded bg-[var(--theme-bg)]"
                />
              </div>

              {isRepeating ? (
                <div>
                  <label className="block mb-1 font-semibold text-[var(--theme-text-muted)]">星期几</label>
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(Number(e.target.value))}
                    className="w-full p-2 border border-[var(--theme-border)] rounded bg-[var(--theme-bg)]"
                  >
                    {weekDays.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block mb-1 font-semibold text-[var(--theme-text-muted)]">选择日期</label>
                  <input
                    type="date"
                    required
                    value={singleDate}
                    onChange={(e) => setSingleDate(e.target.value)}
                    className="w-full p-2 border border-[var(--theme-border)] rounded bg-[var(--theme-bg)] font-sans"
                  />
                </div>
              )}

              <div>
                <label className="block mb-1 font-semibold text-[var(--theme-text-muted)]">类别</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-2 border border-[var(--theme-border)] rounded bg-[var(--theme-bg)]"
                >
                  <option value="course">学生课表</option>
                  <option value="work">工作日程</option>
                  <option value="life">生活日常</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 font-semibold text-[var(--theme-text-muted)]">开始时间</label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full p-2 border border-[var(--theme-border)] rounded bg-[var(--theme-bg)]"
                />
              </div>

              <div>
                <label className="block mb-1 font-semibold text-[var(--theme-text-muted)]">结束时间</label>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full p-2 border border-[var(--theme-border)] rounded bg-[var(--theme-bg)]"
                />
              </div>

              {isRepeating && category === 'course' && (
                <div className="col-span-2">
                  <label className="block mb-1 font-semibold text-[var(--theme-text-muted)]">上课周次 (如 1-16)</label>
                  <input
                    type="text"
                    value={weeks}
                    onChange={(e) => setWeeks(e.target.value)}
                    className="w-full p-2 border border-[var(--theme-border)] rounded bg-[var(--theme-bg)] font-sans"
                  />
                </div>
              )}

              <div>
                <label className="block mb-1 font-semibold text-[var(--theme-text-muted)]">地点 (选填)</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="如：教一302 / 会议室"
                  className="w-full p-2 border border-[var(--theme-border)] rounded bg-[var(--theme-bg)]"
                />
              </div>

              <div>
                <label className="block mb-1 font-semibold text-[var(--theme-text-muted)]">人物 (选填)</label>
                <input
                  type="text"
                  value={teacher}
                  onChange={(e) => setTeacher(e.target.value)}
                  placeholder="如：王老师 / 经理"
                  className="w-full p-2 border border-[var(--theme-border)] rounded bg-[var(--theme-bg)]"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-[var(--theme-text)] text-[var(--theme-bg)] font-bold rounded hover:opacity-90 transition-opacity"
            >
              保存此日程票根
            </button>
          </form>
        </details>
      </div>

      {errorMsg && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200 font-sans">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="mt-4 p-3 bg-green-50 text-green-700 text-xs rounded border border-green-200 font-sans">
          {successMsg}
        </div>
      )}
    </div>
  );
}



