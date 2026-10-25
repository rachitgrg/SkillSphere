import { Response, NextFunction } from 'express';
import Notification from '../models/Notification';
import { AuthRequest } from '../types';

export const getNotifications = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = Number(req.query.limit) || 20;
    const notifications = await Notification.find({ recipient: req.user?._id })
      .sort({ createdAt: -1 })
      .limit(limit);

    res.status(200).json({ success: true, message: 'Notifications retrieved', data: notifications });
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
    await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user?._id });
    res.status(200).json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    next(error);
  }
};
