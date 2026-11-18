"""Command-line interaction."""
import argparse
from weather_agent.agent import WeatherAgent


def main():
    parser = argparse.ArgumentParser(description='Ollama 天气 Agent')
    parser.add_argument('question', nargs='?', help='可选的单次查询问题')
    args = parser.parse_args()
    agent = WeatherAgent()
    if not args.question:
        print('天气 Agent 已启动，例如：北京明天会下雨吗？（exit/quit/退出 结束）')
    while True:
        try:
            question = args.question or input('\n你：').strip()
            if question.lower() in {'exit', 'quit', '退出'}:
                break
            if not question:
                continue
            print('正在查询，请稍候……')
            answer = agent.chat(question)
            print('\n天气助手：' + answer)
        except (EOFError, KeyboardInterrupt):
            print('\n已退出。')
            break
        except Exception as exc:
            print(f'运行失败：{exc}\n请检查网络、Ollama 服务及模型工具调用能力。')
            if args.question:
                raise SystemExit(1) from exc
        if args.question:
            break
