import { Response, NextFunction } from 'express';
import Notification from '../models/Notification';
import { AuthRequest } from '../types';
import { buildPaginationResponse, parsePaginationParams } from '../utils/helpers';

/** GET /notifications?page=&limit=&unread=true — newest first. */
export const getNotifications = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>);
    const filter: Record<string, unknown> = { recipient: req.user!._id };
    if (req.query.unread === 'true') filter.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipient: req.user!._id, isRead: false }),
    ]);

    res.status(200).json({
      success: true,
      message: 'Notifications retrieved',
      data: { notifications, unreadCount },
      pagination: buildPaginationResponse(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

/** GET /notifications/unread-count */
export const getUnreadCount = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const count = await Notification.countDocuments({ recipient: req.user!._id, isRead: false });
    res.status(200).json({ success: true, message: 'Unread count', data: { count } });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user?._id },
      { isRead: true, readAt: new Date() },
      { returnDocument: 'after' }
    );

    if (!notification) {
      res.status(404).json({ success: false, message: 'Notification not found' });
      return;
    }

    res.status(200).json({ success: true, message: 'Notification marked as read', data: notification });
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await Notification.updateMany(
      { recipient: req.user?._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
};

export const deleteNotification = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const deleted = await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user?._id });
    if (!deleted) {
      res.status(404).json({ success: false, message: 'Notification not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    next(error);
  }
};
