"""
A plain English stopword list plus a handful of words that show up
constantly in news headlines but carry no topical meaning ("says",
"report", "new"). Filtering these out is what makes keyword overlap
actually mean something - without it, almost every headline "shares"
words like "the" and "said".
"""

STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "if", "then", "else", "when",
    "at", "by", "for", "with", "about", "against", "between", "into",
    "through", "during", "before", "after", "above", "below", "to",
    "from", "up", "down", "in", "out", "on", "off", "over", "under",
    "again", "further", "once", "here", "there", "all", "any", "both",
    "each", "few", "more", "most", "other", "some", "such", "no", "nor",
    "not", "only", "own", "same", "so", "than", "too", "very", "s", "t",
    "can", "will", "just", "don", "should", "now", "is", "are", "was",
    "were", "be", "been", "being", "have", "has", "had", "having", "do",
    "does", "did", "doing", "would", "could", "of", "as", "it", "its",
    "this", "that", "these", "those", "he", "she", "they", "we", "you",
    "i", "his", "her", "their", "our", "your", "my", "him", "them", "us",
    "who", "what", "which", "how", "why", "where",
    # news-specific noise words
    "says", "said", "new", "news", "report", "reports", "reported",
    "according", "after", "amid", "sources", "update", "latest", "live",
    "video", "watch", "photos", "analysis", "opinion", "editorial",
}
