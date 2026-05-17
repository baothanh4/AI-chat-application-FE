import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

const ChatChart = ({ type = 'bar', data = [], title = '' }) => {
  if (!data || data.length === 0) return null;

  // Extract keys for bars/areas (exclude X-axis labels)
  const xLabels = ['name', 'label', 'year', 'month', 'năm', 'tháng', 'ngay', 'ngày', 'category', 'tiêu chí'];
  const firstItem = data[0];
  const xAxisKey = Object.keys(firstItem).find(k => xLabels.includes(k.toLowerCase())) || Object.keys(firstItem)[0];
  const keys = Object.keys(firstItem).filter(k => k !== xAxisKey && !xLabels.includes(k.toLowerCase()));
  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="chat-visual-chart glass" style={{ 
      margin: '16px 0', 
      padding: '20px', 
      borderRadius: '16px', 
      background: 'rgba(0, 0, 0, 0.3)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      width: '100%',
      maxWidth: '600px'
    }}>
      {title && <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '600', color: 'rgba(255,255,255,0.9)' }}>{title}</h4>}
      
      <div style={{ width: '100%', height: 250 }}>
        <ResponsiveContainer width="100%" height="100%">
          {type === 'area' ? (
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                {keys.map((key, i) => (
                  <linearGradient key={key} id={`color${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors[i % colors.length]} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={colors[i % colors.length]} stopOpacity={0}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey={xAxisKey} 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} 
              />
              <Tooltip 
                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)', color: '#fff' }}
                itemStyle={{ fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
              {keys.map((key, i) => (
                <Area 
                  key={key}
                  type="monotone" 
                  dataKey={key} 
                  stroke={colors[i % colors.length]} 
                  fillOpacity={1} 
                  fill={`url(#color${key})`} 
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          ) : (
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey={xAxisKey} 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} 
              />
              <Tooltip 
                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)', color: '#fff' }}
                itemStyle={{ fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
              {keys.map((key, i) => (
                <Bar 
                  key={key}
                  dataKey={key} 
                  fill={colors[i % colors.length]} 
                  radius={[4, 4, 0, 0]} 
                  barSize={30}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ChatChart;
