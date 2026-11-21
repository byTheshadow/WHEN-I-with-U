import { getDeclaration } from './declarationContent';
import './DeclarationBlock.css';

// 入口页里的折叠声明。默认收起，不增加首屏高度；语言跟随入口页当前语言。
export default function DeclarationBlock({ lang }) {
  const d = getDeclaration(lang);

  return (
    <details className="declaration-block">
      <summary className="declaration-summary">{d.label}</summary>
      <div className="declaration-body">
        <h2 className="declaration-title">{d.title}</h2>
        {d.paragraphs.map((text, index) => (
          <p key={index}>{text}</p>
        ))}
        <h3 className="declaration-subtitle">{d.usageTitle}</h3>
        <ul className="declaration-list">
          {d.usage.map((text, index) => (
            <li key={index}>{text}</li>
          ))}
        </ul>
        <p className="declaration-sign">
          {d.date}
          <br />
          {d.copyright}
        </p>
      </div>
    </details>
  );
}