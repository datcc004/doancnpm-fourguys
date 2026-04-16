import MySQLdb
def test(host, user, passwd, port):
    try:
        db = MySQLdb.connect(host=host, user=user, passwd=passwd, port=port)
        print(f"SUCCESS: {user}@{host}:{port} with '{passwd}' worked")
        db.close()
    except Exception as e:
        print(f"FAILED: {user}@{host}:{port} with '{passwd}': {e}")

passwords = ["root123", "", "root", "admin", "123456", "password", "12345678"]
for p in passwords:
    test("127.0.0.1", "root", p, 3306)
