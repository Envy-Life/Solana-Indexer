cd /etc/yum.repos.d;sudo touch mongodb-org-7.0.repo;echo -e "[mongodb-org-7.0]\nname=MongoDB Repository\nbaseurl=https://repo.mongodb.org/yum/amazon/2023/mongodb-org/7.0/x86_64/\ngpgcheck=1\nenabled=1\ngpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc" | sudo tee -a mongodb-org-7.0.repo;
sudo yum install -y mongodb-org

sudo systemctl enable mongod
sudo systemctl start mongod
