import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  FileText, 
  Clock, 
  MapPin, 
  User, 
  Calendar 
} from 'lucide-react';
import db from '../../db';

export default function RhythmApp({ onBackHub, currentCharacterId }) {
  const [schedules, setSchedules] = useState([]);
  const [activeDay, setActiveDay] = useState(new Date().getDay() || 7); // 1-7
  const [title, setTitle] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:45');
  const [weeks, setWeeks] = useState('1-16');
  const [location, setLocation] = useState('');
  const [teacher, setTeacher] = useState('');
  const [category, setCategory] = useState('course'); // course, work, life
  
  const [pasteData, setPasteData] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1-7 对应的中文星期
  const weekDays = [
    { label: '周一', value: 1 },
    { label: '周二', value: 2 },
    { label: '周三', value: 3 },
    { label: '周四', value: 4 },
    { label: '周五', value: 5 },
    { label: '周六', value: 6 },
    { label: '周日', value: 7 }
  ];

  // 用于发给外部 AI 的提示词
  const getPromptText = () => {
    return `你是一个专业的时间数据格式化助手。请帮我将以下给出的【个人课表】或【工作日程】整理成标准的 JSON 数据。

要求：
1. 只输出标准的 JSON 数组格式，没有任何其他 markdown 语法、解释文本或 Emoji。
2. JSON 数组中每个对象必须且只能包含以下字段：
  - "title": 课程或任务名称（例如："高等数学"、"每周例会"）
  - "dayOfWeek": 星期几，数字 1-7（1代表周一，7代表周日）
  - "startTime": 开始时间，格式 "HH:MM"（例如："08:00"）
  - "endTime": 结束时间，格式 "HH:MM"（例如："09:45"）
  - "weeks": 数组格式，表示上课或进行的周次（例如：1到16周就写 [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]；单周就只写单数；如果是非课程的日常工作，写 [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]）
  - "location": 教室或地点（字符串，若没有填空字串 ""）
  - "teacher": 授课老师或负责人（字符串，若没有填空字串 ""）
  - "category": 类型，必须是 "course"、"work" 或 "life" 之一。

我的日程如下：
------------------------
在此粘贴你的课表文本、工作会表或日常作息
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
      // 按开始时间排序
      data.sort((a, b) => a.startTime.localeCompare(b.startTime));
      setSchedules(data);
    } catch (err) {
      console.error('加载作息日程失败:', err);
    }
  };

  useEffect(() => {
    loadSchedules();
  }, [currentCharacterId]);

  // 解析并导入 JSON
  const handleImportJson = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      let cleanData = pasteData.trim();
      // 过滤可能带有的 markdown code block 标记
      if (cleanData.startsWith('```json')) {
        cleanData = cleanData.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (cleanData.startsWith('```')) {
        cleanData = cleanData.replace(/^```/, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(cleanData);
      if (!Array.isArray(parsed)) {
        throw new Error('导入的数据必须是数组格式');
      }

      // 验证格式并补充 characterId
      const validated = parsed.map((item, index) => {
        if (!item.title || !item.dayOfWeek || !item.startTime || !item.endTime) {
          throw new Error(`第 ${index + 1} 个日程缺少必填项(title, dayOfWeek, startTime, endTime)`);
        }
        
        let parsedWeeks = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20];
        if (Array.isArray(item.weeks)) {
          parsedWeeks = item.weeks;
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

      // 写入 IndexedDB
      await db.transaction('rw', db.schedules, async () => {
        for (const schedule of validated) {
          await db.schedules.add(schedule);
        }
      });

      setSuccessMsg(`成功导入 ${validated.length} 个日程。`);
      setPasteData('');
      loadSchedules();
    } catch (err) {
      setErrorMsg(`解析失败: ${err.message}`);
    }
  };

  // 手动添加单个日程
  const handleAddSingle = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    // 解析 weeks，支持 "1-16" 类似格式
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
      parsedWeeks = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16];
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
      setSuccessMsg('已添加日程。');
    } catch (err) {
      setErrorMsg(`添加失败: ${err.message}`);
    }
  };

  // 删除日程
  const handleDelete = async (id) => {
    try {
      await db.schedules.delete(id);
      loadSchedules();
    } catch (err) {
      console.error('删除日程失败:', err);
    }
  };

  const getCategoryColor = (cat) => {
    switch (cat) {
      case 'course': return 'var(--theme-accent, #8b5a2b)';
      case 'work': return 'var(--theme-text-muted, #7f8c8d)';
      default: return 'var(--theme-text, #2c3e50)';
    }
  };

  const filteredSchedules = schedules.filter(s => s.dayOfWeek === activeDay);

  return (
    <div className="flex flex-col min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)] font-serif p-4 max-w-[420px] mx-auto">
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
        <h3 className="text-sm font-semibold mb-4 tracking-wider text-[var(--theme-text-muted)] flex items-center gap-2">
          <Calendar className="w-4 h-4" /> 今日规划
        </h3>
        
        {filteredSchedules.length === 0 ? (
          <div className="py-12 text-center text-xs italic text-[var(--theme-text-muted)] border border-dashed border-[var(--theme-border)] rounded-lg">
            这一天似乎还空着，去贴入作息吧
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSchedules.map((item) => (
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
                  <span 
                    className="w-1.5 h-1.5 rounded-full" 
                    style={{ backgroundColor: getCategoryColor(item.category) }}
                  />
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
            ))}
          </div>
        )}
      </div>

      {/* 导入区与手动添加折叠 */}
      <div className="border-t border-dashed border-[var(--theme-border)] pt-6 space-y-6">
        {/* 外部 AI 导入向导 */}
        <div className="p-4 bg-[var(--theme-accent-bg,rgba(0,0,0,0.02))] border border-[var(--theme-border)] rounded-lg">
          <h4 className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>使用 AI 助理导入作息</span>
            <button 
              onClick={handleCopyPrompt}
              className="flex items-center gap-1 text-[var(--theme-accent)] hover:opacity-85 text-xs font-sans font-normal"
            >
              {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {isCopied ? '已复制' : '复制提示词'}
            </button>
          </h4>
          <p className="text-[11px] leading-relaxed text-[var(--theme-text-muted)] mb-4">
            复制提示词后，将其发送给任意外部大模型（如 ChatGPT, Claude），并将你的课程或工作表贴给它。把 AI 吐出来的 JSON 数据复制并粘贴到下方导入框中即可。
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
            解析并导入作息
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
                  placeholder="如：高等数学 / 项目晨会"
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
                  placeholder="如：教一302"
                  className="w-full p-2 border border-[var(--theme-border)] rounded bg-[var(--theme-bg)]"
                />
              </div>

              <div>
                <label className="block mb-1 font-semibold text-[var(--theme-text-muted)]">老师/关联人 (选填)</label>
                <input
                  type="text"
                  value={teacher}
                  onChange={(e) => setTeacher(e.target.value)}
                  placeholder="如：王老师"
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

      {/* 提示信息栏 */}
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
