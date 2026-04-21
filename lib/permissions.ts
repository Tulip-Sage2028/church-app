// 每个功能定义哪些角色可以操作
const PERMISSIONS: { [key: string]: string[] } = {
  // 查看权限
  view_events: ["member", "teacher", "leader", "media", "pastor", "admin"],
  view_announcements: ["member", "teacher", "leader", "media", "pastor", "admin"],
  view_qa: ["member", "teacher", "leader", "media", "pastor", "admin"],

  // 聚会日程
  manage_schedules: ["leader", "pastor", "admin"],

  // 主内活动
  manage_events: ["leader", "pastor", "admin"],
  view_attendance_list: ["leader", "pastor", "admin"],

  // 主日学
  view_sunday_school_records: ["teacher", "pastor", "admin"],
  search_sunday_school: ["teacher", "pastor", "admin"],

  // 公告
  manage_announcements: ["leader", "pastor", "admin"],

  // 主日信息
  manage_sermons: ["media", "pastor", "admin"],

  // 读经
  manage_devotionals: ["leader", "pastor", "admin"],

  // 问答
  close_post: ["pastor", "admin"],
  delete_post: ["pastor", "admin"],

  // 系统管理
  access_admin: ["pastor", "admin"],
  manage_user_roles: ["pastor", "admin"],
  delete_user: ["admin"],

};

// 检查用户是否有某个权限
export function can(userRole: string, permission: string): boolean {
  const allowedRoles = PERMISSIONS[permission] || [];
  return allowedRoles.includes(userRole);
}