#!/usr/bin/env python3
"""
콘텐츠 유사도 체크 스크립트
TF-IDF + 코사인 유사도로 중복 검사

Usage:
    check-similarity.py "새 콘텐츠 텍스트"
    check-similarity.py --file content.txt

Exit codes:
    0: 유사도 60% 미만 (업로드 가능)
    1: 유사도 60% 이상 (중복 - 업로드 차단)
    2: 에러
"""

import sys
import os
import sqlite3
import argparse
from pathlib import Path

# sklearn import (venv 활성화 필요)
try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError:
    print("ERROR: scikit-learn이 설치되지 않았습니다.", file=sys.stderr)
    print("설치: source .venv/bin/activate && pip install scikit-learn", file=sys.stderr)
    sys.exit(2)

# 설정
SIMILARITY_THRESHOLD = 0.40  # 40% (민제님 피드백: 50%도 높다)
DB_PATH = Path(__file__).parent.parent.parent / "data" / "sns.db"


def get_existing_content(db_path: Path) -> list[tuple[int, str, str]]:
    """DB에서 기존 콘텐츠 가져오기 (content_queue + posts)"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    results = []
    
    # content_queue에서 가져오기 (posted=0인 것도 포함)
    cursor.execute("""
        SELECT id, content, 'queue' as source 
        FROM content_queue 
        WHERE content IS NOT NULL AND content != ''
    """)
    results.extend(cursor.fetchall())
    
    # posts에서 가져오기
    cursor.execute("""
        SELECT id, content, 'posts' as source 
        FROM posts 
        WHERE content IS NOT NULL AND content != ''
    """)
    results.extend(cursor.fetchall())
    
    conn.close()
    return results


def calculate_similarity(new_content: str, existing_contents: list[str]) -> list[float]:
    """TF-IDF + 코사인 유사도 계산"""
    if not existing_contents:
        return []
    
    # 새 콘텐츠를 첫 번째로 추가
    all_contents = [new_content] + existing_contents
    
    # TF-IDF 벡터화
    vectorizer = TfidfVectorizer(
        analyzer='char_wb',  # 한글 지원을 위해 character n-gram 사용
        ngram_range=(2, 4),  # 2~4글자 단위
        min_df=1,
        max_df=0.95
    )
    
    try:
        tfidf_matrix = vectorizer.fit_transform(all_contents)
    except ValueError:
        # 콘텐츠가 너무 짧거나 특수한 경우
        return [0.0] * len(existing_contents)
    
    # 새 콘텐츠(index 0)와 기존 콘텐츠들 간의 유사도 계산
    similarities = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:]).flatten()
    
    return similarities.tolist()


def check_duplicate(new_content: str, db_path: Path = DB_PATH, threshold: float = SIMILARITY_THRESHOLD) -> tuple[bool, float, str | None]:
    """
    중복 체크
    
    Returns:
        (is_duplicate, max_similarity, similar_content)
    """
    existing = get_existing_content(db_path)
    
    if not existing:
        return False, 0.0, None
    
    contents = [item[1] for item in existing]
    similarities = calculate_similarity(new_content, contents)
    
    if not similarities:
        return False, 0.0, None
    
    max_idx = max(range(len(similarities)), key=lambda i: similarities[i])
    max_similarity = similarities[max_idx]
    
    if max_similarity >= threshold:
        similar_item = existing[max_idx]
        return True, max_similarity, similar_item[1][:100] + "..."
    
    return False, max_similarity, None


def main():
    parser = argparse.ArgumentParser(description="콘텐츠 유사도 체크")
    parser.add_argument("content", nargs="?", help="체크할 콘텐츠 텍스트")
    parser.add_argument("--file", "-f", help="콘텐츠가 담긴 파일")
    parser.add_argument("--threshold", "-t", type=float, default=SIMILARITY_THRESHOLD,
                        help=f"유사도 임계값 (기본: {SIMILARITY_THRESHOLD})")
    parser.add_argument("--db", help=f"DB 경로 (기본: {DB_PATH})")
    parser.add_argument("--verbose", "-v", action="store_true", help="상세 출력")
    parser.add_argument("--json", action="store_true", help="JSON 형식 출력")
    
    args = parser.parse_args()
    
    # 콘텐츠 읽기
    if args.file:
        with open(args.file, 'r', encoding='utf-8') as f:
            content = f.read().strip()
    elif args.content:
        content = args.content
    else:
        # stdin에서 읽기
        content = sys.stdin.read().strip()
    
    if not content:
        print("ERROR: 콘텐츠가 비어있습니다.", file=sys.stderr)
        sys.exit(2)
    
    # DB 경로
    db_path = Path(args.db) if args.db else DB_PATH
    if not db_path.exists():
        print(f"ERROR: DB 파일이 존재하지 않습니다: {db_path}", file=sys.stderr)
        sys.exit(2)
    
    # 임계값 설정
    threshold = args.threshold
    
    # 중복 체크
    is_duplicate, similarity, similar_content = check_duplicate(content, db_path, threshold)
    
    # 출력
    if args.json:
        import json
        result = {
            "is_duplicate": is_duplicate,
            "similarity": round(similarity * 100, 2),
            "threshold": threshold * 100,
            "similar_content": similar_content
        }
        print(json.dumps(result, ensure_ascii=False))
    else:
        if is_duplicate:
            print(f"❌ 중복 감지! 유사도: {similarity*100:.1f}% (임계값: {threshold*100:.0f}%)")
            if args.verbose and similar_content:
                print(f"   유사 콘텐츠: {similar_content}")
            sys.exit(1)
        else:
            print(f"✅ 통과. 최대 유사도: {similarity*100:.1f}% (임계값: {threshold*100:.0f}%)")
            sys.exit(0)


if __name__ == "__main__":
    main()
