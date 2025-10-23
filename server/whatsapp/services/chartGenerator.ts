import { Browser } from 'puppeteer';
import puppeteer from 'puppeteer';

import { logger } from '../../lib/logger.js';

export interface ServiceLogData {
  id: number;
  service_id: number;
  disk_usage_mb: number;
  file_count: number;
  available_space_mb: number;
  available_inode: number;
  created_at: string;
}

export interface ServiceData {
  id: number;
  name: string;
  domain: string;
  status: string;
  logs: ServiceLogData[];
}

export class ChartGenerator {
  private browser: Browser | null = null;

  public async generateServiceStatusChart(serviceData: ServiceData): Promise<Buffer> {
    try {
      if (!this.browser) {
        this.browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
          ],
        });
      }

      const page = await this.browser.newPage();
      await page.setViewport({ width: 900, height: 800 });

      // Generate HTML content for the chart
      const htmlContent = this.generateHTML(serviceData);
      await page.setContent(htmlContent);

      // Wait for charts to render
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Take screenshot
      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: true,
      });

      await page.close();
      return screenshot as Buffer;
    } catch (error) {
      logger.error(`Error generating chart: ${error}`);
      throw error;
    }
  }

  private generateHTML(serviceData: ServiceData): string {
    const logs = serviceData.logs;
    const latestLog = logs[0];

    if (!latestLog) {
      return this.generateNoDataHTML(serviceData);
    }

    // Process data for charts - calculate percentages for each log
    const chartData = this.processLogsForPercentageCharts(logs);

    // Calculate percentages for latest log
    const diskUsagePercentage = Math.min(
      (latestLog.disk_usage_mb / latestLog.available_space_mb) * 100,
      100
    );
    const fileCountPercentage = Math.min(
      (latestLog.file_count / latestLog.available_inode) * 100,
      100
    );

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Service Status - ${serviceData.name}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
            padding: 20px;
            color: #1e293b;
        }
        
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.98);
            border-radius: 20px;
            box-shadow: 0 25px 50px rgba(0,0,0,0.15);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        
        .header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
            animation: pulse 8s ease-in-out infinite;
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.5; }
            50% { transform: scale(1.1); opacity: 0.8; }
        }
        
        .header-content {
            position: relative;
            z-index: 1;
        }
        
        .header h1 {
            font-size: 28px;
            margin-bottom: 6px;
            font-weight: 800;
            letter-spacing: -0.5px;
        }
        
        .header p {
            font-size: 14px;
            opacity: 0.95;
            font-weight: 500;
        }
        
        .status-badge {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 700;
            margin-top: 12px;
            background: ${serviceData.status === 'Active' ? '#10b981' : '#ef4444'};
            color: white;
            text-transform: uppercase;
            letter-spacing: 1px;
            box-shadow: 0 4px 15px ${
              serviceData.status === 'Active' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'
            };
        }
        
        .content {
            padding: 30px;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            padding: 20px;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            position: relative;
            overflow: hidden;
        }
        
        .stat-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 4px;
            height: 100%;
            background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
        }
        
        .stat-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
        }
        
        .stat-icon {
            font-size: 24px;
        }
        
        .stat-label {
            font-size: 12px;
            color: #64748b;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .stat-value {
            font-size: 24px;
            font-weight: 800;
            color: #1e293b;
            line-height: 1;
            margin-bottom: 12px;
        }
        
        .stat-unit {
            font-size: 14px;
            color: #64748b;
            margin-left: 4px;
            font-weight: 600;
        }
        
        .progress-bar {
            background: #e2e8f0;
            border-radius: 10px;
            height: 10px;
            overflow: hidden;
            margin: 12px 0 8px 0;
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.06);
        }
        
        .progress-fill {
            height: 100%;
            border-radius: 10px;
            transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .progress-disk {
            background: linear-gradient(90deg, #10b981 0%, #059669 100%);
            box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
            width: ${diskUsagePercentage}%;
        }
        
        .progress-files {
            background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
            box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
            width: ${fileCountPercentage}%;
        }
        
        .progress-info {
            font-size: 11px;
            color: #64748b;
            font-weight: 600;
        }
        
        .chart-container {
            background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
            padding: 25px;
            border-radius: 16px;
            border: 1px solid #e2e8f0;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        }
        
        .chart-title {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 20px;
            color: #1e293b;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .chart-title::before {
            content: '';
            width: 4px;
            height: 20px;
            background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
            border-radius: 2px;
        }
        
        .chart-wrapper {
            position: relative;
            height: 280px;
        }
        
        .footer {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            padding: 20px;
            text-align: center;
            color: #64748b;
            font-size: 12px;
            font-weight: 500;
            border-top: 1px solid #e2e8f0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-content">
                <h1>${serviceData.name}</h1>
                <p>${serviceData.domain}</p>
                <div class="status-badge">${serviceData.status.toUpperCase()}</div>
            </div>
        </div>
        
        <div class="content">
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-header">
                        <div class="stat-label">Disk Usage</div>
                    </div>
                    <div class="stat-value">
                        ${(latestLog.disk_usage_mb / 1024).toFixed(2)}
                        <span class="stat-unit">GB</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill progress-disk"></div>
                    </div>
                    <div class="progress-info">
                        ${diskUsagePercentage.toFixed(1)}% of ${(
      latestLog.available_space_mb / 1024
    ).toFixed(2)} GB
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-header">
                        <div class="stat-label">File Count</div>
                    </div>
                    <div class="stat-value">
                        ${latestLog.file_count.toLocaleString()}
                        <span class="stat-unit">files</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill progress-files"></div>
                    </div>
                    <div class="progress-info">
                        ${fileCountPercentage.toFixed(
                          1
                        )}% of ${latestLog.available_inode.toLocaleString()}
                    </div>
                </div>
            </div>
            
            <div class="chart-container">
                <div class="chart-title">Usage Trend - Last 7 Logs</div>
                <div class="chart-wrapper">
                    <canvas id="usageChart"></canvas>
                </div>
            </div>
        </div>
        
        <div class="footer">
            Generated on ${new Date().toLocaleString()} | SysTrack WhatsApp Bot
        </div>
    </div>
    
    <script>
        // Usage Percentage Chart - Side by Side Bars
        const ctx = document.getElementById('usageChart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ${JSON.stringify(chartData.labels)},
                datasets: [
                    {
                        label: 'Disk Usage %',
                        data: ${JSON.stringify(chartData.diskPercentages)},
                        backgroundColor: 'rgba(16, 185, 129, 0.8)',
                        borderColor: '#10b981',
                        borderWidth: 2,
                        borderRadius: 6,
                        barPercentage: 0.8
                    },
                    {
                        label: 'File Count %',
                        data: ${JSON.stringify(chartData.filePercentages)},
                        backgroundColor: 'rgba(59, 130, 246, 0.8)',
                        borderColor: '#3b82f6',
                        borderWidth: 2,
                        borderRadius: 6,
                        barPercentage: 0.8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            font: {
                                size: 13,
                                weight: '600'
                            },
                            color: '#475569',
                            padding: 15,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        borderRadius: 8,
                        titleFont: {
                            size: 14,
                            weight: 'bold'
                        },
                        bodyFont: {
                            size: 13
                        },
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + context.parsed.y.toFixed(1) + '%';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            color: '#f1f5f9',
                            drawBorder: false
                        },
                        ticks: {
                            font: {
                                size: 12,
                                weight: '600'
                            },
                            color: '#64748b',
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        ticks: {
                            font: {
                                size: 11,
                                weight: '600'
                            },
                            color: '#64748b'
                        }
                    }
                }
            }
        });
    </script>
</body>
</html>`;
  }

  private processLogsForPercentageCharts(logs: ServiceLogData[]): {
    labels: string[];
    diskPercentages: number[];
    filePercentages: number[];
  } {
    // Take last 7 logs and reverse to show chronologically
    const last7Logs = logs.slice(0, 7).reverse();

    return {
      labels: last7Logs.map((log) => {
        const date = new Date(log.created_at);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }),
      diskPercentages: last7Logs.map((log) => {
        const percentage = Math.min((log.disk_usage_mb / log.available_space_mb) * 100, 100);
        return parseFloat(percentage.toFixed(2));
      }),
      filePercentages: last7Logs.map((log) => {
        const percentage = Math.min((log.file_count / log.available_inode) * 100, 100);
        return parseFloat(percentage.toFixed(2));
      }),
    };
  }

  private generateNoDataHTML(serviceData: ServiceData): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Service Status - ${serviceData.name}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
            padding: 20px;
            color: #1e293b;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
        }
        
        .container {
            max-width: 800px;
            width: 100%;
            background: rgba(255, 255, 255, 0.98);
            border-radius: 20px;
            box-shadow: 0 25px 50px rgba(0,0,0,0.15);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        
        .header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
            animation: pulse 8s ease-in-out infinite;
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.5; }
            50% { transform: scale(1.1); opacity: 0.8; }
        }
        
        .header-content {
            position: relative;
            z-index: 1;
        }
        
        .header h1 {
            font-size: 28px;
            margin-bottom: 6px;
            font-weight: 800;
            letter-spacing: -0.5px;
        }
        
        .header p {
            font-size: 14px;
            opacity: 0.95;
            font-weight: 500;
        }
        
        .status-badge {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 700;
            margin-top: 12px;
            background: ${serviceData.status === 'Active' ? '#10b981' : '#ef4444'};
            color: white;
            text-transform: uppercase;
            letter-spacing: 1px;
            box-shadow: 0 4px 15px ${
              serviceData.status === 'Active' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'
            };
        }
        
        .content {
            padding: 60px 40px;
            text-align: center;
        }
        
        .no-data-icon {
            font-size: 64px;
            margin-bottom: 20px;
            animation: float 3s ease-in-out infinite;
        }
        
        @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-15px); }
        }
        
        .no-data-title {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 12px;
            color: #1e293b;
        }
        
        .no-data-message {
            font-size: 14px;
            color: #64748b;
            line-height: 1.6;
        }
        
        .footer {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            padding: 20px;
            text-align: center;
            color: #64748b;
            font-size: 12px;
            font-weight: 500;
            border-top: 1px solid #e2e8f0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-content">
                <h1>${serviceData.name}</h1>
                <p>${serviceData.domain}</p>
                <div class="status-badge">${serviceData.status.toUpperCase()}</div>
            </div>
        </div>
        
        <div class="content">
            <div class="no-data-icon">📊</div>
            <div class="no-data-title">No Data Available</div>
            <div class="no-data-message">
                No log data available for ${serviceData.name}.<br>
                Try syncing the logs to see service statistics.
            </div>
        </div>
        
        <div class="footer">
            Generated on ${new Date().toLocaleString()} | SysTrack WhatsApp Bot
        </div>
    </div>
</body>
</html>`;
  }

  public async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
