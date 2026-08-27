import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  FileText, 
  Clock, 
  MapPin, 
  User, 
  Calendar,
  Briefcase,
  GraduationCap
} from 'lucide-react';
import db from '../../db';

export default function RhythmApp({ onBackHub, currentCharacterId }) {
  const [schedules, setSchedules] = useState([]);
  const [activeDay, setActiveDay] = useState(new Date().getDay() || 7); // 1-7
  const [activePromptTab, setActivePromptTab] = useState('student'); // student, worker
  
  // 新建日程表单状态
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

  // 针对不同人群生成的外部 AI 提示词
  const getPromptText = () => {
    if (activePromptTab === 'student') {
      return `你是一个专业的时间数据格式化助手。请帮我将以下给出的【大学课表】整理成标准的 JSON 数据。

要求：
1. 只输出标准的 JSON 数组格式，没有任何其他 markdown 语法、解释文本或 Emoji。
2. JSON 数组中每个对象必须且只能包含以下字段：
  - "title": 课程名称（例如："高等数学"）
  - "dayOfWeek": 星期几，数字 1-7（1代表周一，7代表周日）
  - "startTime": 开始时间，格式 "HH:MM"（例如："08:00"）
  - "endTime": 结束时间，格式 "HH:MM"（例如："09:45"）
  - "weeks": 数组格式，表示上课的周次（例如：1到16周就写 [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]；单周就写单数数组；双周写双数数组）
  - "location": 教室地点（字符串，若没有填空字串 ""）
  - "teacher": 授课老师（字符串，若没有填空字串 ""）
  - "category": 类型，此处固定填 "course"

我的课表文本如下：
------------------------
[在此替换粘贴你的大学教务处课表或手写日程文本，例如：
周一早八教三101高数，周四下午两点综合楼302大学英语。
]
------------------------`;
    } else {
      return `你是一个专业的时间数据格式化助手。请帮我将以下给出的【工作/作息日程】整理成标准的 JSON 数据。

要求：
1. 只输出标准的 JSON 数组格式，没有任何其他 markdown 语法、解释文本或 Emoji。
2. JSON 数组中每个对象必须且只能包含以下字段：
  - "title": 会议或日常安排名称（例如："每周例会"、"通勤路上"、"专注搬砖"）
  - "dayOfWeek": 星期几，数字 1-7（1代表周一，7代表周日）
  - "startTime": 开始时间，格式 "HH:MM"（例如："09:30"）
  - "endTime": 结束时间，格式 "HH:MM"（例如："18:00"）
  - "weeks": 数组格式，日常工作默认填满 1 到 20 周（即 [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]）
  - "location": 会议室或地点（字符串，没有填 ""）
  - "teacher": 对接人或负责人（字符串，没有填 ""）
  - "category": 类型，必须是 "work"（工作/会议）或 "life"（生活日常/通勤）之一

我的日常日程文本如下：
------------------------
[在此替换粘贴你的工作日程安排，例如：
周一至周五 09:00-10:00 地铁通勤，10:00-12:00 专注工作，每周三下午 14:00-15:00 在2号会议室开例会。
]
------------------------`;
    }
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
        if (!item.title || !item.dayOfWeek || !item.startTime || !item.endTime) {
          throw new Error(`第 ${index + 1} 个日程信息不完整(必填: title, dayOfWeek, startTime, endTime)`);
        }
        
        let parsedWeeks = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20];
        if (Array.isArray(item.weeks) && item.weeks.length > 0) {
          parsedWeeks = item.weeks.map(Number);
        }

        return {
          characterId: currentCharacterId || 0,
          title: String(item.title).trim(),
          dayOfWeek: Number(item.dayOfWeek),
          startTime: String(item.startTime).trim(),
          endTime: String(item.endTime).trim(),
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
    } catch (err) {
      setErrorMsg(`解析失败: ${err.message}`);
    }
  };

  const handleAddSingle = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    let parsedWeeks = [];
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

    try {
      await db.schedules.add({
        characterId: currentCharacterId || 0,
        title: title.trim(),
        dayOfWeek: Number(dayOfWeek),
        startTime,
        endTime,
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

  const getCategoryBadge = (cat) => {
    switch (cat) {
      case 'course': return { label: '课程', className: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
      case 'work': return { label: '工作', className: 'bg-sky-50 text-sky-700 border-sky-100' };
      default: return { label: '生活', className: 'bg-amber-50 text-amber-700 border-amber-100' };
    }
  };

  const filteredSchedules = schedules.filter(s => s.dayOfWeek === activeDay);

  return (
    <div className="flex flex-col min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)] font-serif p-4 max-w-[420px] mx-auto pb-24">
      {/* 头部标题栏 */}
      <div className="flex items-center justify-between mb-6 pb-2 border-b border-dashed border-[var(--theme-border)]">
        <button onClick={onBackHub} className="p-1 hover:opacity-75 transition-opacity" aria-label="返回">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-lg font-bold tracking-widest text-center">时光作息 Rhythm</span>
        <div className="w-5 h-5" />
      </div>

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

      {/* 日程展示区 */}
      <div className="flex-1 mb-8">
        <h3 className="text-xs font-semibold mb-4 tracking-wider text-[var(--theme-text-muted)] flex items-center gap-2">
          <Calendar className="w-4 h-4" /> 今日时间安排
        </h3>
        
        {filteredSchedules.length === 0 ? (
          <div className="py-12 text-center text-xs italic text-[var(--theme-text-muted)] border border-dashed border-[var(--theme-border)] rounded-lg">
            这一天看起来空荡荡的，去右侧或下方贴入日程吧。
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSchedules.map((item) => {
              const badge = getCategoryBadge(item.category);
              return (
                <div 
                  key={item.id} 
                  className="relative p-4 border border-[var(--theme-border)] rounded-lg bg-[var(--theme-card-bg,rgba(255,255,255,0.4))] shadow-sm hover:shadow transition-all group"
                >
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-[var(--theme-text-muted)] hover:text-red-500"
                    title="删除此日程"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] border font-sans font-bold ${badge.className}`}>
                      {badge.label}
                    </span>
                    <h4 className="font-bold text-sm">{item.title}</h4>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-[var(--theme-text-muted)] font-sans">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{item.startTime} - {item.endTime}</span>
                    </div>
                    
                    {item.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="truncate">{item.location}</span>
                      </div>
                    )}

                    {item.teacher && (
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" />
                        <span className="truncate">{item.teacher}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 col-span-2">
                      <FileText className="w-3.5 h-3.5" />
                      <span>第 {item.weeks.join(', ')} 周</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 导入区与手动添加折叠 */}
      <div className="border-t border-dashed border-[var(--theme-border)] pt-6 space-y-6">
        {/* 外部 AI 导入向导 */}
        <div className="p-4 bg-[var(--theme-accent-bg,rgba(0,0,0,0.02))] border border-[var(--theme-border)] rounded-lg">
          <h4 className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center justify-between">
            <span>使用 AI 助理导入作息</span>
            <button 
              onClick={handleCopyPrompt}
              className="flex items-center gap-1 text-[var(--theme-accent)] hover:opacity-85 text-xs font-sans font-normal"
            >
              {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {isCopied ? '已复制' : '复制提示词'}
            </button>
          </h4>

          {/* 模式选择切换：学生党 vs 工作党 */}
          <div className="flex border-b border-[var(--theme-border)] mb-3 text-[11px] font-sans">
            <button 
              onClick={() => setActivePromptTab('student')}
              className={`flex-1 py-1.5 text-center flex items-center justify-center gap-1 transition-all ${
                activePromptTab === 'student' ? 'border-b-2 border-[var(--theme-accent)] font-bold' : 'opacity-60'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" /> 学生课表
            </button>
            <button 
              onClick={() => setActivePromptTab('worker')}
              className={`flex-1 py-1.5 text-center flex items-center justify-center gap-1 transition-all ${
                activePromptTab === 'worker' ? 'border-b-2 border-[var(--theme-accent)] font-bold' : 'opacity-60'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" /> 工作党日程
            </button>
          </div>

          <p className="text-[10px] leading-relaxed text-[var(--theme-text-muted)] mb-4">
            复制提示词，发给外部 AI（如 Claude/ChatGPT），并将你的课表文本或日常日程发给它。它会为你提取为干净的 JSON。直接粘贴到下方即可导入。
          </p>

          <textarea
            value={pasteData}
            onChange={(e) => setPasteData(e.target.value)}
            placeholder="在此处粘贴 AI 整理生成的 JSON 数据..."
            className="w-full h-24 p-2 text-xs border border-[var(--theme-border)] rounded bg-[var(--theme-bg)] focus:outline-none focus:border-[var(--theme-accent)] font-mono resize-none mb-3"
          />

          <button
            onClick={handleImportJson}
            disabled={!pasteData.trim()}
            className="w-full py-2 bg-[var(--theme-accent)] text-white text-xs font-bold rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            解析并导入日程
          </button>
        </div>

        {/* 手动添加单条日程 */}
        <details className="group border border-[var(--theme-border)] rounded-lg overflow-hidden">
          <summary className="flex justify-between items-center p-3 text-xs font-bold tracking-wider cursor-pointer bg-[rgba(0,0,0,0.01)] hover:bg-[rgba(0,0,0,0.03)] select-none">
            <span>手动添加单条日程</span>
            <Plus className="w-4 h-4 group-open:rotate-45 transition-transform" />
          </summary>
          
          <form onSubmit={handleAddSingle} className="p-4 space-y-4 border-t border-[var(--theme-border)] text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block mb-1 font-semibold text-[var(--theme-text-muted)]">日程/课程名称</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="如：项目站会 / 高等数学"
                  className="w-full p-2 border border-[var(--theme-border)] rounded bg-[var(--theme-bg)]"
                />
              </div>

              <div>
                <label className="block mb-1 font-semibold text-[var(--theme-text-muted)]">重复星期</label>
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

              <div>
                <label className="block mb-1 font-semibold text-[var(--theme-text-muted)]">类型</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-2 border border-[var(--theme-border)] rounded bg-[var(--theme-bg)]"
                >
                  <option value="course">课表日程</option>
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

              <div className="col-span-2">
                <label className="block mb-1 font-semibold text-[var(--theme-text-muted)]">持续周次 (支持 1-16 或 1,3,5)</label>
                <input
                  type="text"
                  value={weeks}
                  onChange={(e) => setWeeks(e.target.value)}
                  className="w-full p-2 border border-[var(--theme-border)] rounded bg-[var(--theme-bg)] font-sans"
                />
              </div>

              <div>
                <label className="block mb-1 font-semibold text-[var(--theme-text-muted)]">教室/地点 (选填)</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="如：线上会议"
                  className="w-full p-2 border border-[var(--theme-border)] rounded bg-[var(--theme-bg)]"
                />
              </div>

              <div>
                <label className="block mb-1 font-semibold text-[var(--theme-text-muted)]">老师/关联人 (选填)</label>
                <input
                  type="text"
                  value={teacher}
                  onChange={(e) => setTeacher(e.target.value)}
                  placeholder="如：项目经理"
                  className="w-full p-2 border border-[var(--theme-border)] rounded bg-[var(--theme-bg)]"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-[var(--theme-text)] text-[var(--theme-bg)] font-bold rounded hover:opacity-90 transition-opacity"
            >
              保存此日程
            </button>
          </form>
        </details>
      </div>

      {errorMsg && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="mt-4 p-3 bg-green-50 text-green-700 text-xs rounded border border-green-200">
          {successMsg}
        </div>
      )}
    </div>
  );
}

